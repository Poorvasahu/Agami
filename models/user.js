const mongoose=require('mongoose');

const userSchema=mongoose.Schema({
    username:{
        type:String,
        unique:true
    },
    fullName:String,
    password:String,
    age:Number,
    registered:[
        {
        type:mongoose.Schema.Types.ObjectId,
        ref:"conference"
        }
        ]
});

module.exports=mongoose.model("user",userSchema);
