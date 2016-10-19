var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');
var ComicSchema = new mongoose.Schema({
    title:{type:String, required:true},
    thumnail:String,
    url:{type:String, required:true},
    status:{type:String},
    updateTime:{
        type:Date,
        default: Date.now,
    },
    viewers:String,
    description: {type:String},
    categories: [],
    authors: [],
    chapters:[{
        _id: false,
        title:{type:String},
        urls:[]
    }]
});
ComicSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('comic', ComicSchema);