const mongoose=require('mongoose');

const adminSchema=mongoose.Schema({
    name:String,
    password:String,
    createdConferences:[
        {
        type:mongoose.Schema.Types.ObjectId,
        ref:"conference"
        }
    ]
});

module.exports=mongoose.model("admin",adminSchema);