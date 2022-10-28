const mongoClient=require('mongodb').MongoClient
const state={
    db:null
}

module.exports.connect=function(done){
    const url='mongodb://localhost:27017'
    const dbname='shopping'
    
    mongoClient.connect(url,(err,date)=>{
        if(err) return done(err)
        state.db=date.db(dbname)
        done()

    })

}
module.exports.get=function(){
    return state.db
}