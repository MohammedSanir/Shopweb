var db=require('../config/connection')
var collection=require('../config/collections')
const bcrypt=require('bcrypt')
var objectId=require('mongodb').ObjectId
const Razorpay=require('razorpay')
const { resolve } = require('path')
var instance = new Razorpay({ 
    key_id: 'rzp_test_6nBJR6fVywVXHg',
    key_secret: 'AZ0uuFGmi94A2i0TLGrPa1FZ' })


module.exports={
    doSignup:(userData)=>{
        return new Promise(async(resolve,reject)=>{
            userData.Password=await bcrypt.hash(userData.Password,10)
            db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((data)=>{
                resolve(data.insertedId)


            })

        })
    },
    doLogin:(userData)=>{
        return new Promise(async (resolve,reject)=>{
            let loginStatus=false
            let response={}
            let user=await db.get().collection(collection.USER_COLLECTION).findOne({Email:userData.Email})
            if(user){
                bcrypt.compare(userData.Password,user.Password).then((status)=>{
                    if(status){
                        console.log("login succeuss");
                        response.user=user
                        response.status=true
                        resolve(response)
                    }else{
                        console.log("login failed");
                        resolve({status:false})
                    }
                })
            }else{
                console.log("login failed");
                resolve({status:false})
            }
            
        })
    },
    addToCart:(proId,userId)=>{
        let proOpj={
            item:objectId(proId),
            quantity:1
        }
        return new Promise(async(resolve,reject)=>{
            let userCart=await db.get().collection(collection.CART_COLLECTION).findOne({user:objectId(userId)})

            if(userCart){
                let proExit=userCart.products.findIndex(product=> product.item==proId)
                if(proExit!=-1){
                    db.get().collection(collection.CART_COLLECTION)
                    .updateOne({user:objectId(userId),'products.item':objectId(proId)},
                    {
                        $inc:{'products.$.quantity':1}
                    }
                    ).then(()=>{
                        resolve()
                    })
                }else{
                db.get().collection(collection.CART_COLLECTION)
                .updateOne({user:objectId(userId)},
                {
                    $push:{products:proOpj}
                }
                ).then((response)=>{
                    resolve()
                })
            } 

            }else{
                let cartOpj={
                    user:objectId(userId),
                    products:[proOpj]
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartOpj).then((response)=>{
                    resolve()

                })

            }
        })
    },
    getCartProducts:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            let cartItems=await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match:{user:objectId(userId)}
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
                        from:collection.PRODUCT_COLLECTION,
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

            ]).toArray()
            resolve(cartItems)
        })
    },
    getCartCount:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            let count=0
            let cart=await db.get().collection(collection.CART_COLLECTION).findOne({user:objectId(userId)})
            if(cart){
                count=cart.products.length
            }
            resolve(count)
        })
    },
    changeProductQuantity:(details)=>{
        details.count=parseInt(details.count)
        details.quantity=parseInt(details.quantity)

        return new Promise((resolve,reject)=>{
            if(details.count==-1 && details.quantity==1){
                db.get().collection(collection.CART_COLLECTION)
                .updateOne({_id:objectId(details.cart)},
                {
                    $pull:{products:{item:objectId(details.product)}}
                }
                ).then((response)=>{
                    resolve({removeProduct:true})
                })
            }else{
                db.get().collection(collection.CART_COLLECTION)
                .updateOne({_id:objectId(details.cart), 'products.item':objectId(details.product)},
                {
                    $inc:{'products.$.quantity':details.count}
                }
                ).then((response)=>{

                    resolve({status:true})

                })
            }
        })
    },
    getTotalAmount:(userId)=>{
            return new Promise(async(resolve,reject)=>{
                console.log(userId)
                let total=await db.get().collection(collection.CART_COLLECTION).aggregate([
                    {
                        $match:{user:objectId(userId)}
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
                            from:collection.PRODUCT_COLLECTION,
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
                        $group:{
                            _id:null,
                            total:{$sum:{$multiply:[{$toInt:"$quantity"},{$toInt:"$product.Price"}]}}
                        }
                    }
    
                ]).toArray()
                resolve(total[0].total)
            })
        },
        placeOrder:(order,products,total)=>{
            return new Promise((resolve,reject)=>{
                let status=order['payment-method']==='COD'?'placed':'pending'
                let orderObj={
                    deliveryDetails:{
                        mobile:order.mobile,
                        address:order.address,
                        pincode:order.pincode
                    },
                    userId:objectId(order.userId),
                    paymentMethod:order['payment-method'],
                    products:products,
                    totalAmount:total,
                    status:status,
                    date:new Date()
                }
                db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response)=>{
                    db.get().collection(collection.CART_COLLECTION).deleteOne({user:objectId(order.userId)})
                    resolve(response.insertedId);
                })
            })
        },
        getCartProductList:(userId)=>{
            return new Promise(async(resolve,reject)=>{
                let cart=await db.get().collection(collection.CART_COLLECTION).findOne({user:objectId(userId)})
                resolve(cart.products)
            })
        },
        getUserOrders:(userId)=>{
            return new Promise(async(resolve,reject)=>{
                let orders=await db.get().collection(collection
                    .ORDER_COLLECTION).find({userId:objectId(userId)}).toArray()
                    resolve(orders)
            })
        },
        getOrderProducts:(orderId)=>{
            return new Promise(async(resolve,reject)=>{
                let orderItems=await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                    {
                        $match:{_id:objectId(orderId)}
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
                            from:collection.PRODUCT_COLLECTION,
                            localField:'item',
                            foreignField:'_id',
                            as:'product'

                        }
                    },

                    {
                        $project:{
                            item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                        }
                    }
                ]).toArray()
                resolve(orderItems)
            })
        },
        genarateRazorpay:(orderId,total)=>{
            return new Promise((resolve,reject)=>{
                var options={
                    amount:total,
                    currency:"INR",
                    receipt:""+orderId
                };
                instance.orders.create(options, function(err,order){
                    if(err){
                        console.log(err);
                    }else{
                        console.log("New Order",order);
                    resolve(order)
                    }
                })

            })
        },
        verifyPayment:(details)=>{
            console.log(details);
            return new Promise((resolve,reject)=>{
                const crypto = require('crypto');
                let hmac = crypto.createHmac('sha256','AZ0uuFGmi94A2i0TLGrPa1FZ')

                hmac.update(details['payment[razorpay_order_id]']+'|'+details['payment[razorpay_payment_id]']);
                hmac=hmac.digest('hex')
                console.log(hmac);
                console.log(details['payment[razorpay_signature]']);

                if(hmac==details['payment[razorpay_signature]']){
                    resolve()
                }else{
                    reject()
                }
            })
        },
        changePaymentStatus:(orderId)=>{
            return new Promise((resolve,reject)=>{
                db.get().collection(collection.ORDER_COLLECTION)
                .updateOne({_id:objectId(orderId)},
                {
                    $set:{
                        status:'placed'
                    }
                }
                ).then(()=>{ 
                    resolve()
                })
            })
        }
}
