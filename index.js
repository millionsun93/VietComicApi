var express = require("express");
var app = express();
var mongoose = require("mongoose");
var bodyParser = require('body-parser');
var config = require('./config');
// var Ajv = require('ajv');
// var ajv = new Ajv();

var uriString = process.env.MONGOLAB_URI 
    || process.env.MONGODB_URI
    || "mongodb://172.17.0.2/comics";

var PORT = process.env.PORT || 3000;

var db = mongoose.connection;
var ObjectId = mongoose.Types.ObjectId;

var Comic = require("./models/comic");

// var chapterSchema = {
//     "properties":{
//         "title":{"type":"string"},
//         "urls":{"type":"array","items":{"type":"string"},"minItems":1}
//     },
//     "required":["title","urls"]
// }

app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

mongoose.connect(uriString);
mongoose.connection.on('connected', function(){
    console.log("mongoose connected to " + uriString);
});
mongoose.connection.on('error', function(){
    console.log("mongoose failed to connect to "+uriString);
});

var responseFormat= {
    error: "0", //0 for none,1 for error
    description:"error description if neccessary",
    data: {} //actual data;
}

var sendResult = function(res, err,data){
    if(err || !data){
        responseFormat.error = 1;
        responseFormat.description = err;
        if(!err && !data){
            responseFormat.description = "Can't find document";
        }
        delete responseFormat.data;
        res.json(responseFormat);
    } else {
        responseFormat.error = 0;
        delete responseFormat.description;
        responseFormat.data = data;
        res.json(responseFormat);
    }
}

if (!Array.prototype.last){
    Array.prototype.last = function(){
        return this[this.length - 1];
    };
};

var router = express.Router();

router.use(function(req,res,next){    
    if(req.method != 'GET' && req.headers.authorization != config.authorization ){
        sendResult(res,"unauthorized");
    } else {
        next();
    }
});

router.route('/')
	.get(function(req,res){
		res.send("<img src='images/potato.jpg'/>");
	});

//get all category
router.route('/categories').get(function(req,res){
    Comic.find().distinct('categories', function(err, categories){
        sendResult(res, err, categories);
    });
});

//get all author
router.route('/authors').get(function(req,res){
    Comic.find().distinct('authors', function(err, authors){
        sendResult(res,err,authors);
    });
});


//get comic with optional query category and author
//pagination with query page (default 1)
//limit by 10 comic
//order by updatetime
router.route('/comics')
	.get(function(req,res){
		var query = {};		
		if(req.query.category){
			query.categories=req.query.category;
		}
		if(req.query.author){
			query.authors = req.query.author;
		}
        if(req.query.search){
            query.title = new RegExp(req.query.search,'i');
        }
		var paginate = {};		
		if(req.query.page){
			paginate.page=req.query.page;					
		} else{
            paginate.page=1;
        }
        paginate.limit = 20;

		Comic.paginate(query,{select:"-chapters.urls", page:paginate.page,sort:{updateTime: -1}, limit: paginate.limit, lean: true}, function(err,result){
			if(!err){
                result.docs.forEach(function(item){
                    if(item.chapters)                    
                        item.latestChapter = item.chapters.last()?item.chapters.last().title:"";
                    delete item.chapters;
                    if(req.query.realm){
                        item.authors = item.authors.join("<|>");
                        item.categories = item.categories.join("<|>");
                    }
                });
			}
            res.set("Cache-Control", "public, max-age=3600");
            res.set("Expires", new Date(Date.now() + 3600).toUTCString()); 
            sendResult(res,err,result.docs);
		});
	})
    //create new comic
    .post(function(req,res){
        Comic.create(req.body, function(err, comic){
            sendResult(res,err,comic);
        });        
    });

router.route('/comics/:id')
    //get comic with id 
    .get(function(req,res){
        Comic.findById(req.params.id, "-chapters.urls").lean().exec(function(err,comic){       
            res.set("Cache-Control", "public, max-age=3600");
            res.set("Expires", new Date(Date.now() + 3600).toUTCString());
	    if(req.query.realm){
 	 	comic.authors = comic.authors.join("<|>");
                comic.categories = comic.categories.join("<|>");
 	    }
	    sendResult(res,err,comic);
        });

    })
    //update current comic with id
    .put(function(req,res){
       Comic.findByIdAndUpdate(req.params.id, req.body).exec(function(err,comic){   
            sendResult(res,err,"comic was updated"); 
       });
    })
    //update chapter comic, this api seems not right, but i want it that way
    .post(function(req,res){
        console.log(req.body);        
        Comic.findById(req.params.id, function(err,comic){
            if(err){
                sendResult(res,err,data);
            }
            comic.chapters.push(req.body);
            comic.save(function(newerr, newcomic){                
                sendResult(res,newerr,"new chapter updated ");
            });
            
        });

    });

//get comic chapter with chapter id and chapter name
router.route('/comics/:id/:chapter')
	.get(function(req,res){
		Comic.aggregate(
            {$match:{_id: new ObjectId(req.params.id)}},
            {$unwind:"$chapters"},
            {$match:{'chapters.title': req.params.chapter}},
            {$project: {"chapters":1, _id: 0}}).exec(
        function(err, comic){
            res.set("Cache-Control", "public, max-age=2592000");
            res.set("Expires", new Date(Date.now() + 2592000000).toUTCString()); 
            var result = comic[0]?comic[0].chapters:comic[0];
            if(result.urls && req.query.realm){
                result.urls = result.urls.join("<!>");
            }
            sendResult(res,err,result);
        });
	});

app.use('/api', router);

//let's play
app.listen(PORT, function(){
    console.log("app is running at " + PORT);
});
