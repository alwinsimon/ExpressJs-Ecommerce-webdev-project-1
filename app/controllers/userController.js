/*======================================= USER CONTROLLERS =======================================*/

const path = require('path');
const productHelpers = require(path.join(__dirname,'..','..','/helpers/product-helpers'));
const userHelpers = require(path.join(__dirname,'..','..','/helpers/user-helpers'));

require('dotenv').config(); // Module to Load environment variables from .env file


let PLATFORM_NAME = process.env.PLATFORM_NAME || "GetMyDeal"


/* ========================HOME Page Controller======================== */

const homePageGET = async (req, res, next)=>{

  let user = req.session.userSession //used for authenticating a user visit if user has already logged in earlier

  let cartCount = null;

  if(user){

    cartCount = await userHelpers.getCartCount(req.session.userSession._id);

  }

  productHelpers.getAllProducts().then((products)=>{

    if(user){

      res.render('user/view-products', { title: user.name +"'s " + PLATFORM_NAME, products, admin:false, user, cartCount });

    }else{

      res.render('user/view-products', { title:PLATFORM_NAME, products, admin:false });

    }

  })
  
}
  

/* ========================USER LOGIN / LOGOUT Controllers======================== */
  
const userLogInGET = (req,res)=>{
  
  if(req.session.userLoggedIn){

    res.redirect('/');

  }else{

    res.render('user/login',{"loginError":req.session.userLogginErr, title:PLATFORM_NAME + " || Login", admin:false});

    delete req.session.userLogginErr; 
    /*
    Resetting the flag for checking if the login page post request was due to invalid username or password.
    This is done so that the login page will show the message only once if there was a redirect to this page due to invalid credentials.
    */
    
  }
  
}
  
const userLogInPOST = (req,res)=>{
  
  if(req.session.userLoggedIn){

    res.redirect('/');

  }else{

    userHelpers.doUserLogin(req.body).then((doUserLoginResponse)=>{

      if(doUserLoginResponse.status){
  
        req.session.userSession = doUserLoginResponse.userData; // Storing response from doAdminLogin function in session storage
  
        req.session.userLoggedIn = true;
  
        res.redirect('/');
  
      }else if(doUserLoginResponse.emailError){
  
        req.session.userLogginErr = "Email Invalid !!!"; 
        /*Setting a flag for keeping a record of the login error which happened due to admin entering invalid credentials.
          This flag will be checked in every login request so that we can display an error message in the case of reloading the login page due to invalid credentials entered by admin.
          This flag variable is stored in the session using req.session so that it will be accesible everywhere.
          The name of this flag variable can be anything ie, this is NOT an predefined name in the session module.
        */
  
        res.redirect('/login');
  
      }else if(doUserLoginResponse.passwordError){
  
        req.session.userLogginErr = "Invalid Password Entered!!!";
  
        res.redirect('/login');
  
      }else if(doUserLoginResponse.blockedUser) {

        // If the user is blocked

        req.session.blockedUser = true;

        req.session.userLogginErr = "We are extremely sorry to inform that your account has been temporarily suspended - Please contact the Site Admin for resolution";
  
        res.redirect('/login');

      }else{

        req.session.userLogginErr = "oops! something went wrong and we couldn't process your login request - please contact site admin for resolution";
  
        res.redirect('/login');

      }
  
    })
    
  }
  
}
  
const userLogOutPOST = (req,res)=>{
  
  delete req.session.userSession;

  delete req.session.userLoggedIn;

  res.redirect('/');
  
}
  
  
/* ========================USER SIGN-UP Controllers======================== */
  
const userSignUpGET = (req,res)=>{
  
  res.render('user/signup',{title:PLATFORM_NAME + " || Sign-up", user:true});
  
}
  
const userSignUpPOST = (req,res)=>{
  
  req.session.userSignupData = req.body;

  userHelpers.createUserSignUpOtp(req.body).then((response)=>{

    if(response.statusMessageSent){

      res.redirect('/verify-user-signup');

    }else{

      let signUpErrMessage = "Unable to sent OTP to the provided phone number, Please re-check the number!";

      res.render('user/signup',{title:PLATFORM_NAME + " || Sign-up", user:true, signUpErrMessage});

    }

  })
  
}
  
const verifyUserSignUpGET = (req,res)=>{
  
  if(req.session.userSignupData){

    res.render('user/sign-in-otp-validation',{title:PLATFORM_NAME + " || Verify Sign-Up OTP", user:true});

  }else{

    res.redirect('/signup');

  }
  
}
  
const verifyUserSignUpPOST = (req,res)=>{
  
  let otpFromUser = req.body.otp;

  let userSignUpRequestData = req.session.userSignupData;

  let userPhoneNumber = userSignUpRequestData.phone;

  userHelpers.verifyUserSignUpOtp(otpFromUser, userPhoneNumber).then((verificationData)=>{

    if(verificationData.verified){

      userHelpers.doUserSignup(userSignUpRequestData).then((userData)=>{
    
        // console.log(user);
    
        req.session.userSession = userData;
    
        req.session.userLoggedIn = true;

        delete req.session.userSignupData;
        // Deleting the userData that was stored in session after the user succesfully sign-In (To prevent session storage being unnecassarily used)
    
        res.redirect('/');
    
      })

    }else{

      let otpError = verificationData.otpErrorMessage

      res.render('user/sign-in-otp-validation',{title:PLATFORM_NAME + " || Verify OTP", user:true, otpError});

    }

  })
  
}


/* ========================Single Product Page Controller======================== */

const singleProductPageGET =  (req, res) => {

  let user = req.session.userSession;
  let productId = req.params.id;

  productHelpers.getProductDetails(productId).then(async (productDetails) => {

    if (user) {

      cartCount = await userHelpers.getCartCount(req.session.userSession._id);

      res.render('user/single-product-page', { title: user.name + "'s " + PLATFORM_NAME + " || " + productDetails.name, admin: false, user: true, user, cartCount, productDetails });

    } else {

      res.render('user/single-product-page', { title: PLATFORM_NAME + " || " + productDetails.name, admin:false, productDetails });
      
    }

  }).catch((err) => {

    console.log("Error from user/product-details route: " , err);

    res.redirect('/error-page'); // Redirect to an error page if there was an error

  });
    
}


/* ========================CART Controllers======================== */

const cartGET = async (req,res)=>{

  let user = req.session.userSession //To pass user name to cart-page while rendering - used to display Custom title for page.

  let cartCount = null;

  if(user){

    cartCount = await userHelpers.getCartCount(req.session.userSession._id);

  }

  if(cartCount > 0){  // If there is atleast 1 item in the database, then calculate fetch items and value from db
    
    let cartItems = await userHelpers.getCartProducts(req.session.userSession._id);

    let cartValue = await userHelpers.getCartValue(user._id);

    // console.log(cartItems);
    // console.log(cartValue);

    res.render('user/cart',{ title: user.name + "'s " + PLATFORM_NAME + " || Cart" , admin:false, user, cartItems, cartCount, cartValue });

  }else{ // If there is no items in the cart - then redirect to a different page to avoid the query to database for cartitems and cartvalue

    res.redirect('/empty-cart');

  }
  
}
  
const emptyCartGET = async (req,res)=>{
  
  let user = req.session.userSession //To pass user name to the page while rendering - used to display Custom title for page.

  if(user){

    cartCount = await userHelpers.getCartCount(req.session.userSession._id);

    res.render('user/empty-cart',{ title: user.name + "'s " + PLATFORM_NAME + " || Empty Cart" , admin:false, user, cartCount });

  }else{

    res.render('user/empty-cart',{ title: user.name + "'s " + PLATFORM_NAME + " || Empty Cart" , admin:false });

  }
  
}
  
const addToCartGET = (req,res)=>{
  
  // console.log("api call");

  userHelpers.addToCart(req.params.id,req.session.userSession._id).then(()=>{

    res.json({status:true});

  })
  
}
  
const changeCartProductQuantityPOST = (req,res,next)=>{
  
  // console.log(req.body);

  userHelpers.changeCartProductQuantity(req.body).then( async (response)=>{

    response.cartValue =  await userHelpers.getCartValue(req.body.userId); // Adding a cartValue feild to response object 

    // console.log(response.cartValue);

    res.json(response); 
    /* 
    # Used JSON to send data back here as RESPONSE to AJAX Call from cart page
    # As we are using AJAX there is no need of sending back a complete web page or redirecting to a webpage (which will load the page completely)
    # We can configure the AJAX to use the data in JSON format for updating the specific element of webpage
    */
  
  }).catch((err)=>{

    console.log(err);

    reject(err);
    
  });
  
}
  
const deleteCartProductPOST = (req,res,next)=>{
  
  // console.log(req.body);

  userHelpers.deleteProductFromCart(req.body).then((response)=>{

    res.json(response); 
    /* 
    # Used JSON to send data back here as RESPONSE to AJAX Call from cart page
    # As we are using AJAX there is no need of sending back a complete web page or redirecting to a webpage (which will load the page completely)
    # We can configure the AJAX to use the data in JSON format for updating the specific element of webpage
    */
  
  }).catch((err)=>{

    console.log(err);

    reject(err);
    
  });
  
}


/* ========================ORDERS & PAYMENTS Controllers======================== */

const userOrdersGET = async (req,res)=>{

  let user = req.session.userSession // Used for storing user details for further use in this route

  let orderDetails = await userHelpers.getUserOrderHistory(user._id);

  res.render('user/orders',{ title: user.name +"'s " + PLATFORM_NAME + " || Orders" , admin:false, user, orderDetails});
  
}
  
const userOrderDetailsPOST = async (req,res)=>{
  
  let user = req.session.userSession // Used for storing user details for further use in this route

  // console.log(req.body);

  let orderId = req.body.orderId;

  let productDetails = await userHelpers.getProductsInOrder(orderId);

  let orderDate = await userHelpers.getOrderDate(orderId); // For passing order date to the page

  // console.log(orderDate);

  res.render('user/ordered-product-details',{ title: user.name +"'s " + PLATFORM_NAME + " || Ordered Product Details" , admin:false, user, productDetails, orderDate});
  
}

const placeOrderGET = async (req,res)=>{
  
  let user = req.session.userSession // Used for storing user details for further use in this route

  // console.log(user._id);

  cartCount = await userHelpers.getCartCount(req.session.userSession._id);

  if(cartCount > 0){

    let cartProducts = await userHelpers.getCartProducts(user._id);

    let cartValue = await userHelpers.getCartValue(user._id);

    // console.log(cartProducts);

    // console.log(cartValue);

    res.render('user/place-order',{ title: user.name +"'s " + PLATFORM_NAME + " || Order Summary" , admin:false, user, cartProducts, cartValue});

  }else{

    res.redirect('/empty-cart');
  }
  
}
  
const placeOrderPOST = async (req,res)=>{
  
  let user = req.session.userSession // Used for storing user details for further use in this route

  let orderDetails = req.body;
  // console.log(req.body);

  let orderedProducts = await userHelpers.getProductListForOrders(user._id);
  // This variable will store the product details if cart exist for user, else will store a boolean value false returned by the function

  if(orderedProducts){ // If there are products inside user cart , Proceed executing checkout functions

    let totalOrderValue = await userHelpers.getCartValue(user._id);

    userHelpers.placeOrder(user,orderDetails,orderedProducts,totalOrderValue).then((orderId)=>{

      if(req.body['payment-method']==='COD'){

        res.json({COD_CHECKOUT:true});
  
      }else if(req.body['payment-method']==='ONLINE'){
  
        userHelpers.generateRazorpayOrder(orderId,totalOrderValue).then((razorpayOrderDetails)=>{

          // console.log(razorpayOrderDetails);

          userHelpers.createPaymentHistory(user,orderId,orderDetails,totalOrderValue,razorpayOrderDetails);
          // Creating a new document in payment history collection in the Database with all the available data of the placed order

          let razorpayKeyId = process.env.RAZORPAY_KEY_ID

          res.json(

            {
              ONLINE_CHECKOUT:true,
              userDetails:user,
              userOrderRequestData:orderDetails,
              orderDetails:razorpayOrderDetails,
              razorpayKeyId:razorpayKeyId
            }
            
          );

        });
  
      }else{
  
        res.json({paymentStatus:false});

      }

    });

  }else{ // If there are NO products inside user cart , Send a status back in json

    res.json({checkoutStatus:false});

  }
    
}
  
const orderSuccessGET = (req,res)=>{
  
  let user = req.session.userSession // Used for storing user details for further use in this route

  res.render('user/order-success',{ title: user.name +"'s " + PLATFORM_NAME + " || Order Placed!!!" , admin:false, user});
  
}
  
const orderFailedGET = (req,res)=>{
  
  let user = req.session.userSession // Used for storing user details for further use in this route

  res.render('user/order-failed',{ title: user.name +"'s " + PLATFORM_NAME + " || Sorry, Order failed" , admin:false, user});
  
}
  
const verifyPaymentPOST = (req,res)=>{
  
  // console.log(req.body);

  // The below verifyOnlinePayment function will match the signature returned by Razorpay with our server generated signature
  userHelpers.verifyOnlinePayment(req.body).then(()=>{

    // The below function updateOnlineOrderPaymentStatus will be called upon succesful verification of payment by verifyOnlinePayment above
    // updateOnlineOrderPaymentStatus function will update the payment status in DB

    let receiptId = req.body['serverOrderDetails[receipt]'];

    let paymentSuccess = true;

    userHelpers.updateOnlineOrderPaymentStatus(receiptId, paymentSuccess).then(()=>{

      // Sending the receiptId to the above userHelper to modify the order status in the DB
      // We have set the Receipt Id is same as the orders cart collection ID

      res.json({status:true});

      // console.log('Payment Succesful from Update online Orders');

    })
    

  }).catch((err)=>{

    if(err){
      
      console.log(err);

      let paymentSuccess = false;

      userHelpers.updateOnlineOrderPaymentStatus(receiptId, paymentSuccess).then(()=>{

        // Sending the receiptId to the above userHelper to modify the order status in the DB
        // We have set the Receipt Id is same as the orders cart collection ID

        res.json({status:false});

        // console.log('Payment Failed from Update online Orders');

      })
    
    }

  });
  
}

const savePaymentDataPOST = async (req,res)=>{
  
  let paymentGatewayResponse = req.body;

  // console.log(paymentGatewayResponse);

  if(req.body.razorpay_signature){

    let orderId = req.body.razorpay_order_id;

    let dbPaymentHistoryCollectionId = await userHelpers.getPaymentHistoryId(orderId);

    // console.log(dbPaymentHistoryCollectionId);

    userHelpers.updatePaymentHistory(dbPaymentHistoryCollectionId, paymentGatewayResponse).then(()=>{

      res.json({status:true});

    });

  }else{

    let failedPaymentData = req.body;

    let orderId = failedPaymentData['error[metadata][order_id]'];

    let dbPaymentHistoryCollectionId = await userHelpers.getPaymentHistoryId(orderId);

    // console.log(dbPaymentHistoryCollectionId);

    userHelpers.updatePaymentHistory(dbPaymentHistoryCollectionId, paymentGatewayResponse).then(()=>{

      res.json({status:true});

    })

  }
  
}











module.exports = {

  homePageGET,
  userLogInGET,
  userLogInPOST,
  userLogOutPOST,
  userSignUpGET,
  userSignUpPOST,
  verifyUserSignUpGET,
  verifyUserSignUpPOST,
  singleProductPageGET,
  cartGET,
  emptyCartGET,
  addToCartGET,
  changeCartProductQuantityPOST,
  deleteCartProductPOST,
  userOrdersGET,
  userOrderDetailsPOST,
  placeOrderGET,
  placeOrderPOST,
  orderSuccessGET,
  orderFailedGET,
  verifyPaymentPOST,
  savePaymentDataPOST

}