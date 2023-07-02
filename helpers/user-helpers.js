const db = require("../config/externalConnectionsConfig");
const collections = require('../config/databaseCollectionsConfig');
const bcrypt = require('bcrypt');
const ObjectId = require("mongodb").ObjectId;
const paymentGateway = require("../config/externalConnectionsConfig");
const moment = require('moment-timezone'); // Module to modify the time to various time zones
const twilio = require("../config/externalConnectionsConfig");
const { reject } = require("bluebird");

require('dotenv').config(); // Module to Load environment variables from .env file



/*==============================Payment Gateway Configuration========== */

const razorpayInstance = paymentGateway.razorpayInstance; 
// Creating an new instance of the Razorpay using the instance(object of Razorpay) that was created and exported from connection.js


module.exports = {

    verifyDuplicateUserSignUpData : (requestData)=>{

        return new Promise( async (resolve, reject) => {

            try {

                const registrationEmail = requestData.email;

                const registrationUserName = requestData.userName;

                const emailExists = await db.get().collection(collections.USER_COLLECTION).find( { email : registrationEmail} ).toArray();

                const userNameExists = await db.get().collection(collections.USER_COLLECTION).find( { userName : registrationUserName} ).toArray();

                if( emailExists.length === 0 && userNameExists.length === 0 ){

                    // Email and Username dosen't exist in the database, so new user registration can be done.

                    resolve( {success : true} );

                }else if( emailExists.length && userNameExists.length != 0 ){

                    resolve("Email and User Name already exist");

                }else if (emailExists.length != 0) {
                    
                    // Email already exist in the database

                    resolve("Email already exist");

                }else if (userNameExists.length != 0) {
                    
                    // Username already exist in the database
                    
                    resolve("User Name already exist");
                
                }
      
            } catch (error) {

              console.log("Error from verifyDuplicateUserSignUpData: ", error);
      
              reject(error);
      
            }
      
        });

    },
    createUserSignUpOtp : (requestData)=>{

        return new Promise( async (resolve, reject) => {

            try {

                let userPhone = '+91' + requestData.phone;

                twilio.sendOTPwithTwilio({ to: userPhone, channel: "sms" })
                .then((verificationData) => {

                    // console.log(verificationData);

                    if(verificationData.status === 'pending'){

                        verificationData.statusMessageSent = true;

                        resolve(verificationData);

                    }else{

                        verificationData.statusMessageSent = false;

                        reject(verificationData);

                    }
                
                });
      
            } catch (error) {
      
              reject(error);
      
            }
      
        });

    },
    verifyUserSignUpOtp : (otpFromUser, userPhoneNumber)=>{

        userPhoneNumber = "+91" + userPhoneNumber;

        return new Promise( async (resolve, reject) => {

            try {
      
                twilio.verifyOTPwithTwilio({ to: userPhoneNumber, code: otpFromUser })
                .then((verificationResult) => {
                    
                    // console.log(verificationResult.status);

                    if(verificationResult.status === "approved"){

                        verificationResult.verified = true;

                        resolve(verificationResult);

                    }else{

                        verificationResult.verified = false;

                        verificationResult.otpErrorMessage = "In-correct OTP Provided, Please enter correct OTP";

                        resolve(verificationResult);
                    }
                
                });
      
            } catch (error) {
      
              reject(error);
      
            }
      
        });

    },
    doUserSignup:(userData)=>{

        return new Promise(async (resolve,reject)=>{

            userData.password = await bcrypt.hash(userData.password,10);

            userData.joinedOn = new Date();

            userData.blocked = false;

            const userCollection = await db.get().collection(collections.USER_COLLECTION);

            userCollection.insertOne(userData).then((insertResult)=>{

                const insertedId = insertResult.insertedId;

                // ====== Creating a wallet for user while sign-up
                db.get().collection(collections.WALLET_COLLECTION).insertOne({userId: ObjectId(insertedId), walletBalance: 0});

                userCollection.findOne({_id: insertedId}).then((userData)=>{

                    // console.log(user);

                    resolve(userData);

                }).catch((err)=>{

                    if(err){

                        console.log(err);

                        reject(err);
                        
                    }
                    
                });

            })

        })

    },
    doUserLogin:(loginFormData)=>{

        let userAuthenticationResponse = {};

        return new Promise( async (resolve,reject)=>{

            let user = await db.get().collection(collections.USER_COLLECTION).findOne({email:loginFormData.email});

            if(user){

                if(user.blocked){

                    // If the user IS A Blocked user

                    userAuthenticationResponse.status = false;
    
                    userAuthenticationResponse.blockedUser = true;

                    resolve(userAuthenticationResponse);

                }else{

                    // If the user is NOT a Blocked user

                    bcrypt.compare(loginFormData.password, user.password).then((verificationData)=>{

                        if(verificationData){
    
                            userAuthenticationResponse.status = true;
    
                            userAuthenticationResponse.userData = user;
    
                            resolve(userAuthenticationResponse);
    
                        }else{
    
                            userAuthenticationResponse.status = false;
    
                            userAuthenticationResponse.passwordError = true;
    
                            resolve(userAuthenticationResponse);
    
                        }
    
                    })

                }

            }else{

                userAuthenticationResponse.status = false;

                userAuthenticationResponse.emailError = true;

                resolve(userAuthenticationResponse);

            }

        })

    },
    getUserData : (userId)=>{
        
        return new Promise( async (resolve,reject)=>{

            let currentUserData = await db.get().collection(collections.USER_COLLECTION).findOne({_id : ObjectId(userId)});

            resolve(currentUserData);

        })

    },
    updateUserData : (userId, requestDataForUpdation)=>{
        
        return new Promise( async (resolve,reject)=>{

            try {
                
                const dataForUpdation = {

                    userName : requestDataForUpdation.userName,

                    name : requestDataForUpdation.name,

                    lastName : requestDataForUpdation.lastName,

                    age : requestDataForUpdation.age,

                    phoneNumberAlternative : requestDataForUpdation.phoneNumberAlternative,

                    userTagline : requestDataForUpdation.userTagline

                }

                const userCollection = await db.get().collection(collections.USER_COLLECTION);

                userCollection.updateOne( 
                    
                    {_id: ObjectId(userId)},

                    {$set: dataForUpdation }
                )

                resolve({success:true});

            } catch (error) {

                console.log(error);

                reject(error);

            }

        })

    },
    insertUserAddress: (userId, addressData) => {

        return new Promise(async (resolve, reject) => {

            const userAddressCollection = await db.get().collection(collections.USER_ADDRESS_COLLECTION).findOne({ userId: ObjectId(userId) });
      
            if (userAddressCollection != null) { // If there is a existing address collection for the user, add new address to it

                if(userAddressCollection.address.length > 0){

                    addressData._id = new ObjectId();

                    addressData.dateOfCreation = new Date();

                    addressData.primaryAddress = false;

                    await db.get().collection(collections.USER_ADDRESS_COLLECTION).updateOne(

                        { userId: userId },

                        {$push: {address: addressData}}

                    ).then((response) => {

                        resolve(response);

                    }).catch((error) => {

                        console.log("Error from insertUserAddress userHelper: ", error);

                        reject(error);

                    });

                }else{

                    addressData._id = new ObjectId();

                    addressData.dateOfCreation = new Date();

                    addressData.primaryAddress = true;

                    await db.get().collection(collections.USER_ADDRESS_COLLECTION).updateOne(

                        { userId: userId },

                        {$push: {address: addressData}}

                    ).then((response) => {

                        resolve(response);

                    }).catch((error) => {

                        console.log("Error from insertUserAddress userHelper: ", error);

                        reject(error);

                    });

                }

            } else if( userAddressCollection == null){ // If there is NO existing address collection for the user, create a collection with incoming address

                addressData._id = new ObjectId();

                addressData.dateOfCreation = new Date();

                addressData.primaryAddress = true;

                let userAddress = {

                userId: userId,

                address: [addressData]

                };
        
                await db.get().collection(collections.USER_ADDRESS_COLLECTION).insertOne(userAddress).then((response) => {

                    resolve(response);

                }).catch((error) => {
                    
                    reject(error);

                });

            }

        });

    },
    getUserAddress: (userId) => {

        return new Promise(async (resolve, reject) => {

          try {

                const userAddressCollection = await db.get().collection(collections.USER_ADDRESS_COLLECTION).find({ userId: ObjectId(userId) });
        
                if (userAddressCollection) { // If there is an existing address collection for the user

                    const addresses = await userAddressCollection.toArray();

                    const addressArray = addresses.flatMap((address) => address.address);

                    resolve(addressArray);

                } else { // If there is NO existing address for the user

                    resolve([]);

                }

            } catch (error) {

                reject(error);

            }

        });

    },
    getUserPrimaryAddress: (userId) => {

        return new Promise(async (resolve, reject) => {

          try {

            const userAddressCollection = db.get().collection(collections.USER_ADDRESS_COLLECTION);

            const userAddress = await userAddressCollection.findOne({ userId: ObjectId(userId) });
      
            if (userAddress) { // If there is an existing address collection for the user

              const addresses = userAddress.address;
      
              // Find the address object with primaryAddress set to true
              const primaryAddress = addresses.find((address) => address.primaryAddress === true);
      
              resolve(primaryAddress);

            } else { // If there is NO existing address for the user

              resolve(false);

            }

          } catch (error) {

            reject(error);

          }

        });

    },
    changePrimaryAddress: (userId, addressId) => {

        return new Promise(async (resolve, reject) => {

          try {

                const query = { userId: userId, "address.primaryAddress": true };

                const update = {$set: { "address.$.primaryAddress": false }};
        
                await db.get().collection(collections.USER_ADDRESS_COLLECTION).updateOne(query, update);
        
                const newQuery = { userId: ObjectId(userId), "address._id": ObjectId(addressId) };

                const newUpdate = { $set: { "address.$.primaryAddress": true } };
        
                await db.get().collection(collections.USER_ADDRESS_COLLECTION).updateOne(newQuery, newUpdate);
        
                resolve({status : true});

            } catch (error) {

                console.log("Error from updatePrimaryAddress userHelper: ", error);

                reject(error);
            }

        });

    },
    editUserAddress: (userId, dataToUpdate) => {

        return new Promise(async (resolve, reject) => {

          try {

                // Manipulating data before inserting to db to match the data typed in the db
                dataToUpdate._id = ObjectId(dataToUpdate._id);
                dataToUpdate.dateOfCreation = new Date();
                if(dataToUpdate.primaryAddress === "true"){
                    dataToUpdate.primaryAddress = true;
                }else{
                    dataToUpdate.primaryAddress = false;
                }
        
                const query = { userId: ObjectId(userId), "address._id": ObjectId(dataToUpdate._id) };

                const update = { $set: { "address.$": dataToUpdate } };
        
                await db.get().collection(collections.USER_ADDRESS_COLLECTION).updateOne(query, update);
        
                resolve({status : true});

            } catch (error) {

                console.log("Error from editUserAddress userHelper: ", error);

                reject(error);
            }

        });

    },
    deleteUserAddress: (userId, addressId) => {
        return new Promise(async (resolve, reject) => {
          try {
            const addressCollection = db.get().collection(collections.USER_ADDRESS_COLLECTION);
      
            const userQuery = { userId: ObjectId(userId) };
            const userAddress = await addressCollection.findOne(userQuery);
      
            const addressIndex = userAddress.address.findIndex(
              (address) => address._id.toString() === addressId
            );
      
            if (addressIndex !== -1) {
              const isPrimaryAddress = userAddress.address[addressIndex].primaryAddress;
      
              // If the address being deleted is the primary address
              if (isPrimaryAddress) {
                // Check if there are other addresses
                if (userAddress.address.length > 1) {
                  // Find the first non-deleted address and update it as the new primary address
                  const newPrimaryAddressIndex = userAddress.address.findIndex(
                    (address, index) => index !== addressIndex
                  );
      
                  userAddress.address[newPrimaryAddressIndex].primaryAddress = true;
                }
              }
      
              // Remove the address being deleted from the address array
              userAddress.address.splice(addressIndex, 1);
      
              const updateQuery = {
                $set: {
                  address: userAddress.address,
                },
              };
      
              await addressCollection.updateOne(userQuery, updateQuery);
            }
      
            resolve({ status: true });
          } catch (error) {
            console.log("Error from deleteUserAddress userHelper: ", error);
            reject(error);
          }
        });
    },
    getUserWalletData : (userId)=>{
        
        return new Promise( async (resolve,reject)=>{

            try{
                    
                let userWalletData = await db.get().collection(collections.WALLET_COLLECTION).findOne({userId : ObjectId(userId)});

                resolve(userWalletData);

            } catch (error){

                console.log("Error from getUserWalletData userHelper : " , error);

                reject(error);
            
            }

        })

    },
    addToCart:(productId, userId)=>{

        // Creating a object to store the product and the product quantity inside the cart
        let productObject = {

            item:ObjectId(productId),

            quantity: 1

        }

        return new Promise(async (resolve,reject)=>{

            // Checking if there is a Cart Existing for this user (using user id) in the cart collection
            let userCart = await db.get().collection(collections.CART_COLLECTION).findOne({user:ObjectId(userId)});

            // console.log(userCart);

            if(userCart){ // If there is a CART PRESENT for user, update the existing cart of the user

                /*
                # Check if the productId provided already exist in any of the productObjects inside the products array of the user cart.
                */
                let productExist = userCart.products.findIndex(product => product.item == productId);
                /*
                # productExist will have the value of -1 if there is no product existing in the products array of user cart
                # if product exists already, productExist will have the value of the index in which the product exists in the products array of user cart
                */

                if(productExist !== -1){ // If the value of productExists is NOT EQUAL TO -1, which means there is the same product existing in products array inside user cart already.

                    // Since the same product exists already, UPDATE (INCREMENT) the value of quantity inside the productObject

                    db.get().collection(collections.CART_COLLECTION)
                    .updateOne(

                        {user:ObjectId(userId),'products.item':ObjectId(productId)}, // Matching the same product in the products array of cart collection of the user

                        {$inc:{'products.$.quantity':1}}

                    ).then(()=>{

                        resolve();

                    }).catch((err)=>{

                        if(err){

                            console.log(err);
    
                            reject(err);
                            
                        }
                        
                    });

                    // console.log('CART EXISTS for user == Same Product exist for user == Quantity Modified');

                }else{ // User have a cart in cart collection, but DON'T have the given product existing in the products array of user cart already.

                    // Add the new product object to the products array of the usercart
                    db.get().collection(collections.CART_COLLECTION)
                    .updateOne(

                        {user:ObjectId(userId)},

                        {$push:{products:productObject}}

                    ).then(()=>{

                        resolve();

                    }).catch((err)=>{

                        if(err){

                            console.log(err);
    
                            reject(err);
                            
                        }
                        
                    });

                    // console.log('CART EXISTS for user == Same Product DOSENT exist in cart == Product added to producs array');

                }

            }else{ // If there is NO EXISTING CART for the user, create new cart and insert the product to the cart

                let cartObject = {
                    
                    user: ObjectId(userId),

                    products: [productObject]

                }  

                db.get().collection(collections.CART_COLLECTION)
                .insertOne(cartObject)
                .then((data)=>{

                    // console.log(data);

                    resolve()

                }).catch((err)=>{

                    if(err){

                        console.log(err);

                        reject(err);
                        
                    }

                });

                // console.log('New CART Created for user & New product added to cart:');

            }

        })
    },
    getUserWishListData: (userId) => {

        return new Promise(async (resolve, reject) => {

          try {
            
                const pipeline = [

                    {$match: { userId: ObjectId(userId) }},

                    {
                        $lookup: {

                        from: collections.PRODUCT_COLLECTION,

                        localField: "products",

                        foreignField: "_id",

                        as: "products"

                        }
                    },

                    {
                        $project: {products: 1}
                    }

                ];
        
                const result = await db.get().collection(collections.WISH_LIST_COLLECTION).aggregate(pipeline).toArray();
        
                if (result.length > 0) {

                    resolve(result[0].products);

                } else {

                    resolve([]);

                }

            } catch (error) {

                console.log("Error from getUserWishListData userHelper: ", error);

                reject(error);

            }

        });

    },
    addOrRemoveFromWishList:(productId, userId)=>{

        return new Promise(async (resolve,reject)=>{

            // Checking if there is a wishlist Existing for this user (using user id) in the wishlist collection
            const userWishlist = await db.get().collection(collections.WISH_LIST_COLLECTION).findOne({userId:ObjectId(userId)});

            // console.log(userWishlist);

            if(userWishlist){ // If there is a WISH LIST PRESENT for user, update the existing WISH LIST of the user

                /*
                # Check if the productId provided already exist in products array of the user Wishlist.
                */
                const productExist = userWishlist.products.findIndex(products => products == productId);

                // console.log(productExist);

                /*
                # productExist will have the value of -1 if there is no product existing in the products array of user wishlist
                # if product exists already, productExist will have the value of the index in which the product exists in the products array of user cart
                */

                if(productExist !== -1){ // If the value of productExists is NOT EQUAL TO -1, which means there is the same product existing in products array inside user wish list already.

                    // Since the same product exists already, remove it from the products array

                    db.get().collection(collections.WISH_LIST_COLLECTION)
                    .updateOne(

                        {userId:ObjectId(userId)}, // Matching the same product in the products array of cart collection of the user

                        {$pull:{products:ObjectId(productId)}}

                    ).then(()=>{

                        resolve({removed:true});

                    }).catch((err)=>{

                        if(err){

                            console.log(err);
    
                            reject(err);
                            
                        }
                        
                    });

                    // console.log('WISHLIST EXISTS for user == Given Product exist for user == Product removed from wishlist');

                }else{ // User have a document in wishlist collection, but DON'T have the given product existing in the products array of wishlist document already.

                    // Add the new product object to the products array of the usercart
                    db.get().collection(collections.WISH_LIST_COLLECTION)
                    .updateOne(

                        {userId:ObjectId(userId)},

                        {$push:{products:ObjectId(productId)}}

                    ).then(()=>{

                        resolve({status:true});

                    }).catch((err)=>{

                        if(err){

                            console.log(err);
    
                            reject(err);
                            
                        }
                        
                    });

                    // console.log('WISHLIST EXISTS for user == Given Product DOSENT exist in WISHLIST == Product added to products array');

                }

            }else{ // If there is NO EXISTING WISHLIST for the user, create new WISHLIST and insert the product to the WISHLIST

                const newUserWishlist = {
                    
                    userId: ObjectId(userId),

                    products: [ObjectId(productId)]

                }  

                db.get().collection(collections.WISH_LIST_COLLECTION)
                .insertOne(newUserWishlist)
                .then((data)=>{

                    // console.log(data);

                    resolve({status:true})

                }).catch((err)=>{

                    if(err){

                        console.log(err);

                        reject(err);
                        
                    }

                });

                // console.log('New WISHLIST Created for user & product added to WISHLIST with Product ID:', productId );

            }

        })

    },
    getWishlistCount:(userId)=>{

        return new Promise(async(resolve,reject)=>{
            
            let count = 0;

            const wishList = await db.get().collection(collections.WISH_LIST_COLLECTION).findOne({userId:ObjectId(userId)});

            if(wishList != null){

                count = wishList.products.length;

            }

            resolve(count);

        })

    },
    getCartProducts: (userId) => {

        return new Promise(async (resolve, reject) => {

          let cartItems = await db.get().collection(collections.CART_COLLECTION).aggregate([

                {$match: { user: ObjectId(userId) }},

                {$unwind: '$products'},

                {$project: {item: '$products.item', quantity: '$products.quantity'}},
                
                {$lookup: 
                    {
                        from: collections.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },

                {$project: 
                    {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },

                {$addFields: 
                    {productTotal: {$multiply: [ { $toInt: '$quantity' }, { $toInt: '$product.price' } ] } } 
                }

            ]).toArray();
      
          // console.log(cartItems);

          resolve(cartItems);

        });

    },
    getCartCount:(userId)=>{

        return new Promise(async(resolve,reject)=>{
            
            let count = 0;

            let cart = await db.get().collection(collections.CART_COLLECTION).findOne({user:ObjectId(userId)});

            if(cart){

                count = cart.products.length;

            }

            resolve(count);

        })    
    },
    getOrdersCount:(userId)=>{

        return new Promise(async(resolve,reject)=>{

            try {

                let count = 0;

                const orders = await db.get().collection(collections.ORDERS_COLLECTION).find({userId:ObjectId(userId)}).toArray();

                if(orders){

                    count = orders.length;

                }

                resolve(count);
                
            } catch (error) {

                console.log("Error from getOrdersCount userHelper ======>", error);

                reject(error);
                
            }
            

        })    
    },
    changeCartProductQuantity:(cartData)=>{

        // console.log(cartData);

        // Convert the count received to integer to using in incrementing or decrementing product quantity in DB
        cartData.count = parseInt(cartData.count);

        // Convert the quantity received to integer to using in incrementing or decrementing product quantity in CART PAGE
        cartData.quantity = parseInt(cartData.quantity);

        return new Promise((resolve,reject)=>{

            if(cartData.quantity == 1 && cartData.count == -1){
                // If the existing product quantity id 1 and decrement button clicked by user, remove the product from user cart

                db.get().collection(collections.CART_COLLECTION)
                .updateOne(
                    {

                      _id: ObjectId(cartData.cart),
                    
                    },
                    {
                    
                        $pull: { products:{item:ObjectId(cartData.product)} }, // Remove the product from user Cart
                    
                    }
                    ).then((data)=>{
    
                        // console.log(data);
    
                        resolve({cartProductRemoved:true});
                        // Send a status to Ajax call as boolean inside aobject, for indicating the product removal 
    
                    }).catch((err)=>{
    
                        if(err){

                            console.log(err);
    
                            reject(err);
                            
                        }
    
                    }
                );

            }else{ // Increment or decrement the product quantity in cart according to count

                db.get().collection(collections.CART_COLLECTION)
                .updateOne(
                    {
                      _id: ObjectId(cartData.cart),
                      "products.item": ObjectId(cartData.product),
                    },
    
                    {
                      $inc: { "products.$.quantity": cartData.count },
                    }
                    ).then((data)=>{
    
                        // console.log(data);
    
                        resolve({status:true});
    
                    }).catch((err)=>{
    
                        if(err){

                            console.log(err);
    
                            reject(err);
                            
                        }
    
                    }
                );

            }

        })

    },
    deleteProductFromCart:(productDetails)=>{

        return new Promise((resolve,reject)=>{

            db.get().collection(collections.CART_COLLECTION)
            .updateOne(
                {
    
                  _id: ObjectId(productDetails.cart),
                
                },
                {
                
                    $pull: { products:{item:ObjectId(productDetails.product)} }, // Remove the product from user Cart
                
                }
                ).then((data)=>{
    
                    // console.log(data);
    
                    resolve({cartProductRemoved:true});
                    // Send a status to Ajax call as boolean inside aobject, for indicating the product removal 
    
                }).catch((err)=>{
    
                    if(err){

                        console.log(err);

                        reject(err);
                        
                    }
    
                }
            );

        })

    },
    getCartValue:(userId)=>{
        
        return new Promise( async(resolve,reject)=>{

            let totalCartValue = await db.get().collection(collections.CART_COLLECTION).aggregate([
                
                {

                    $match:{user:ObjectId(userId)}

                },
                {

                    $unwind:'$products'

                },
                {

                    $project:{

                        item:'$products.item',

                        quantity:'$products.quantity'

                    }

                },
                {

                    $lookup:{

                        from:collections.PRODUCT_COLLECTION,

                        localField:'item',

                        foreignField:'_id',

                        as:'product'

                    }

                },
                {

                    $project:{

                        item:1,

                        quantity:1,

                        product:{$arrayElemAt:['$product',0]}

                    }

                },
                {
                  $project: {
                    item: 1,
                    quantity: 1,
                    product: {
                      $mergeObjects: [
                        '$product',
                        { price: { $toInt: '$product.price' } }
                      ]
                    }
                  }
                },
                {
                    
                    $group:{

                        _id:null,

                        cartValue:{$sum:{$multiply:['$quantity', '$product.price']}} 

                    }

                }

            ]).toArray();

            // console.log(totalCartValue[0]);

            resolve(totalCartValue[0].cartValue);

        });

    },
    getProductListForOrders:(userId)=>{

        return new Promise( async(resolve,reject)=>{

            let cart = await db.get().collection(collections.CART_COLLECTION).findOne({user:ObjectId(userId)});

            if(cart){ // Send cart products if cart exist for user in db cart collection

                resolve(cart.products);

            }else{ // Send a status false (boolean), if cart dosen't exist for user in db cart collection

                resolve(false);

            }

        })

    },
    placeOrder:(user,orderData,orderedProducts,totalOrderValue)=>{

        // console.log(orderData);

        let orderStatus = orderData['payment-method'] === 'COD' ? 'Order Placed' : 'Payment Pending'

        let orderDetails = {

            userId:ObjectId(user._id),

            userName:user.name,

            date: new Date(),
        
            orderValue:totalOrderValue,

            paymentMethod:orderData['payment-method'],

            orderStatus:orderStatus,

            products:orderedProducts,

            deliveryDetails:{

                addressId:ObjectId(orderData.addressId),

                addressType:orderData.addressType,

                addressLine1:orderData.addressLine1,

                addressLine2:orderData.addressLine2,

                addressStreet:orderData.addressStreet,

                addressCity:orderData.addressCity,

                addressState:orderData.addressState,

                addressCountry:orderData.addressCountry,

                addressPostalCode:orderData.addressPostalCode,

                addressContactNumber:orderData.addressContactNumber

            }            
        
        }

        // console.log(orderDetails);

        return new Promise((resolve,reject)=>{

            db.get().collection(collections.ORDERS_COLLECTION).insertOne(orderDetails).then((dbOrderDetails)=>{

                let dbOrderId = dbOrderDetails.insertedId.toString(); 
                // To return back the inserted Id of the order which is returned from Db to use in payment gateway order creation.

                // console.log(dbOrderId);

                db.get().collection(collections.CART_COLLECTION).deleteOne({user:ObjectId(user._id)}).then((deleteResult)=>{

                    // console.log(deleteResult);

                    resolve(dbOrderId); // Returning back the order Id in orders collection of DB to use in payment gateway order creation

                })


            }).catch((err)=>{
    
                if(err){

                    console.log(err);

                }

                reject(err);

            });
        });
    },
    getUserOrderHistory:(userId)=>{

        // console.log(userId);

        return new Promise( async (resolve,reject)=>{

            try {

                let orderHistory = await db.get().collection(collections.ORDERS_COLLECTION).find({userId:ObjectId(userId)}).sort({ date: -1 }).toArray();

                orderHistory.forEach((order) => { // Code to check and verify if the order is eligible for Return

                    const currentDate = new Date();

                    const orderDate = new Date(order.date);

                    const diffInDays = Math.floor(

                      (currentDate - orderDate) / (1000 * 60 * 60 * 24)

                    );

                    order.returnEligible = diffInDays <= 10; // Value will be true if LHS is less than or equal to RHS

                });
          
                orderHistory = orderHistory.map(history => { // For Converting the time from DB to IST
    
                  const createdOnIST = moment(history.date)
                  .tz('Asia/Kolkata')
                  .format('DD-MMM-YYYY h:mm A');
          
                  return { ...history, date: createdOnIST + " IST"};
    
                });

                // console.log(orderHistory);
          
                resolve(orderHistory);
    
            } catch (error) {

            reject(error);

            }


        })

    },
    getProductsInOrder:(orderId)=>{

        return new Promise( async (resolve,reject)=>{

            let productDetails = await db.get().collection(collections.ORDERS_COLLECTION).aggregate([
                
                {

                    $match:{_id:ObjectId(orderId)}

                },
                {

                    $unwind:'$products'

                },
                {

                    $project:{

                        item:'$products.item',

                        quantity:'$products.quantity'

                    }

                },
                {

                    $lookup:{

                        from:collections.PRODUCT_COLLECTION,

                        localField:'item',

                        foreignField:'_id',

                        as:'product'

                    }

                },
                {

                    $project:{

                        item:1,

                        quantity:1,

                        product:{$arrayElemAt:['$product',0]}

                    }

                }

            ]).toArray();

            // console.log(productDetails);

            resolve(productDetails);
 
        });

    },
    getOrderDate:(orderId)=>{

        // console.log(userId);

        return new Promise( async (resolve,reject)=>{

            let orderDetails = await db.get().collection(collections.ORDERS_COLLECTION).find({_id:ObjectId(orderId)}).toArray();

            // console.log(orderDetails[0].date);

            resolve(orderDetails[0].date);

        })

    },
    generateRazorpayOrder:(orderId,orderValue)=>{

        orderValue = orderValue * 100; 
        // To convert paisa into rupees as the Razorpay takes the amount in smallest currency unit (paisa) 
        // Amount is in currency subunits. Default currency is INR. Hence, 1 refers to 1 paise, so here the amount is multiplied by 100 to convert it to rupees

        return new Promise((resolve,reject)=>{

            let orderDetails = {

                amount: orderValue,
                currency: "INR",
                receipt: orderId

            };

            // console.log(orderDetails);

            razorpayInstance.orders.create(orderDetails, function(err, orderDetails) {

                if(err) {

                    console.log('Order Creation Error from Razorpay: ' + err);

                }else{

                    // console.log("New order created by Razorpay: " + orderDetails);

                    resolve(orderDetails);

                }

            });

        })

    },
    verifyOnlinePayment:(paymentData)=>{

        // console.log(paymentData);

        return new Promise((resolve,reject)=>{

            const crypto = require('crypto'); // Requiring crypto Module here for generating server signature for payments verification

            let razorpaySecretKey = process.env.RAZORPAY_SECRET_KEY;

            let hmac = crypto.createHmac('sha256', razorpaySecretKey); // Hashing Razorpay secret key using SHA-256 Algorithm
        
            hmac.update(paymentData['razorpayServerPaymentResponse[razorpay_order_id]'] + '|' + paymentData['razorpayServerPaymentResponse[razorpay_payment_id]']); 
            // Updating the hash (re-hashing) by adding Razprpay payment Id and order Id received from client as response
        
            let serverGeneratedSignature = hmac.digest('hex');
            // Converted the final hashed result into hexa code and saving it as server generated signature

            let razorpayServerGeneratedSignatureFromClient = paymentData['razorpayServerPaymentResponse[razorpay_signature]']
        
            if(serverGeneratedSignature === razorpayServerGeneratedSignatureFromClient){ 
                // Checking that is the signature generated in our server using the secret key we obtained by hashing secretkey,orderId & paymentId is same as the signature sent by the server 

                // console.log("Payment Signature Verified");

                resolve()
        
            }else{
        
                // console.log("Payment Signature Verification Failed");

                reject()
        
            }

        })

    },
    updateOnlineOrderPaymentStatus:(ordersCollectionId, onlinePaymentStatus)=>{

        // console.log("updateOnlineOrderPaymentStatus Function Called");

        return new Promise((resolve,reject)=>{

            if(onlinePaymentStatus){

                db.get().collection(collections.ORDERS_COLLECTION)
                  .updateOne(

                    { _id: ObjectId(ordersCollectionId) },

                    { $set: { orderStatus: "Order Placed" } }

                  ).then(() => {

                    resolve();

                  }

                );

            }else{

                db.get().collection(collections.ORDERS_COLLECTION)
                  .updateOne(

                    { _id: ObjectId(ordersCollectionId) },

                    { $set: { orderStatus: "Order Failed" } }

                ).then(() => {
                    
                    resolve() 
                    
                });

            }

        });

    },
    createPaymentHistory:(userData,ordersCollectionId,checkoutData,orderValue,orderDataToRazorpay)=>{

        return new Promise( (resolve,reject)=>{

            let paymentData = {

                userDetails : userData,

                orderId : ordersCollectionId,

                date: new Date(),

                orderDetails : checkoutData,

                amount : orderValue,

                serverGeneratedOrderToPaymentGateway : orderDataToRazorpay
            }

            db.get().collection(collections.PAYMENT_HISTORY_COLLECTION).insertOne(paymentData)
            .then(()=>{

                resolve();

            })

        })

    },
    updatePaymentHistory:(paymentHistoryCollectionId, paymentDataFromGateway)=>{

        return new Promise( (resolve,reject)=>{

            db.get().collection(collections.PAYMENT_HISTORY_COLLECTION).updateOne(

                {_id:paymentHistoryCollectionId},

                { $set: { razorpayServerResponse: paymentDataFromGateway }}

            ).then((data)=>{

                // console.log(data);

                resolve();

            })

        })

    },
    getPaymentHistoryId:(orderId)=>{

        return new Promise( (resolve,reject)=>{

            db.get().collection(collections.PAYMENT_HISTORY_COLLECTION).aggregate([

                {
                  $match: {"serverGeneratedOrderToPaymentGateway.id": orderId}
                },
                {
                  $project: {_id: 1}
                }

            ]).toArray((error, result) => {

                if (error) {

                  console.error("Error:", error);

                  reject(err);

                } else if (result.length > 0) {

                  let paymentHistoryId = result[0]._id;

                  //   console.log("Retrieved paymentHistoryId:", paymentHistoryId);

                  resolve(paymentHistoryId);
   
                } else {

                  console.log("No document found with the specified criteria");

                  reject(result);

                }

            });

        })

    },
    requestOrderCancellation : (orderId)=>{
        
        return new Promise( async (resolve,reject)=>{

            try {

                let OrderDetails = await db.get().collection(collections.ORDERS_COLLECTION).updateOne(
                    
                    {_id:ObjectId(orderId)},
                    
                    { $set: { cancellationStatus: "Pending Admin Approval" }}

                ).then((response)=>{

                    resolve(response);

                })
    
            } catch (error) {

                console.log("Error from requestOrderCancellation userHelper: " , error);

                reject(error);

            }

        })

    },
    requestOrderReturn : (orderId)=>{
        
        return new Promise( async (resolve,reject)=>{

            try {

                await db.get().collection(collections.ORDERS_COLLECTION).updateOne(
                    
                    {_id:ObjectId(orderId)},
                    
                    { $set: { returnStatus: "Pending Admin Approval" }}

                ).then((response)=>{

                    resolve(response);

                })
    
            } catch (error) {

                console.log("Error from requestOrderReturn userHelper: " , error);

                reject(error);

            }

        })

    }

}
