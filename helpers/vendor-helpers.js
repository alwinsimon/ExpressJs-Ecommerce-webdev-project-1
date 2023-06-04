const db = require("../config/connection");
const collections = require('../config/collections')
const bcrypt = require('bcrypt');
const ObjectId = require("mongodb").ObjectId;
const paymentGateway = require('../config/connection');

require('dotenv').config(); // Module to Load environment variables from .env file





module.exports = {

    doVendorSignup:(vendorSignupFormData)=>{

        return new Promise(async (resolve,reject)=>{

            vendorSignupFormData.password = await bcrypt.hash(vendorSignupFormData.password,10);

            vendorSignupFormData.joinedOn = new Date();

            vendorSignupFormData.blocked = false;

            const vendorCollection = db.get().collection(collections.VENDOR_COLLECTION);

            vendorCollection.insertOne(vendorSignupFormData).then((insertResult)=>{

                const insertedId = insertResult.insertedId;

                vendorCollection.findOne({_id: insertedId}).then((vendorData)=>{

                    // console.log(user);

                    resolve(vendorData);

                }).catch((err)=>{

                    if(err){

                        console.log(err);

                        reject(err);
                        
                    }
                    
                });

            })

        })

    },
    doVendorLogin:(loginFormData)=>{

        let vendorAuthenticationResponse = {};

        return new Promise( async (resolve,reject)=>{

            let vendor = await db.get().collection(collections.VENDOR_COLLECTION).findOne({email:loginFormData.email});

            if(vendor){

                bcrypt.compare(loginFormData.password, vendor.password).then((verificationData)=>{

                    if(verificationData){

                        vendorAuthenticationResponse.status = true;

                        vendorAuthenticationResponse.vendorData = vendor;

                        resolve(vendorAuthenticationResponse);

                    }else{

                        vendorAuthenticationResponse.status = false;

                        vendorAuthenticationResponse.passwordError = true;

                        resolve(vendorAuthenticationResponse);

                    }

                })

            }else{

                vendorAuthenticationResponse.status = false;

                vendorAuthenticationResponse.emailError = true;

                resolve(vendorAuthenticationResponse);

            }

        })

    }

}