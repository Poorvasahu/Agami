const mongoose=require('mongoose');

const confSchema=mongoose.Schema({
    title:String,
    date:Date,
    attendees:[
        {
        type:mongoose.Schema.Types.ObjectId,
        ref:"user"
        }
    ],
    feedback:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"feedback"
        }
    ]
});

module.exports=mongoose.model("conference",confSchema);
