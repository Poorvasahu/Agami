const mongoose=require('mongoose');

const feedSchema=mongoose.Schema({
    date:{
        type:Date,
        default:Date.now
    },
    attender:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user"
    },
    forConf:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"conference"
    },
    content:String
});

module.exports=mongoose.model("feedback",feedSchema);
