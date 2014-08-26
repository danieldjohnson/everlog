angular.module('everlog.services', [])

.value('elTokens',{
	foursquareClientId:'<INSERT FOURSQUARE APP CLIENT ID>',
	foursquareClientSecret:'<INSERT FOURSQUARE APP CLIENT SECRET>',
	foursquareApiVersion:'20140819',
	evernoteNoteStoreURL:'<INSERT EVERNOTE NOTE STORE URL>',
	evernoteToken:'<INSERT EVERNOTE DEVELOPER TOKEN>'
})
.factory('qWrap',function($q){
	return function(fn){
		var deferred = $q.defer();
		fn(function(a){deferred.resolve(a);},function(a){deferred.reject(a);});
		return deferred.promise;
	}
})
.factory('elLocation',function($q,$timeout){
	var cacheLength = 1000*60*5;
	cacheLength = 0;
	function getCoarseLocation(cb,errcb){
		console.log('Getting coarser location');
		navigator.geolocation.getCurrentPosition(
				function(pos){
					console.log("Coarse location success");
					cb(pos);
				}, 
	            function(err){
					console.log("Coarse location error ",err);
	            	errcb(err);
	            }, {
	            	maximumAge: 1000*60*5,
	            	timeout: 5000,
	            	enableHighAccuracy: false,
	            });
	}
	return {
		getLocation:function(){
			console.log('Getting current location');
			var deferred = $q.defer();
			navigator.geolocation.getCurrentPosition(
				function success(pos){
					deferred.resolve(pos.coords);
				}, 
	            function err(err){
	            	getCoarseLocation(function(pos){
						deferred.resolve(pos.coords);
	            	},function(err){
	            		deferred.reject(err);
	            	});
	            }, {
	            	maximumAge: cacheLength,
	            	timeout: 5000,
	            	enableHighAccuracy: true,
	            });
			return deferred.promise;
		},
		watchLocation:function(callback,errorCallback){
			console.log('Watching current location');
			return navigator.geolocation.watchPosition(
				function success(pos){
					callback(pos.coords);
				}, 
	            function err(err){
	            	getCoarseLocation(function(pos){
						callback(pos.coords);
	            	},function(err){
	            		errorCallback(err);
	            	});
	            }, {
	            	maximumAge: cacheLength,
	            	timeout: 5000,
	            	enableHighAccuracy: true,
	            });
		},
		clearWatch:function(id){
			console.log('Stop watching current location');
			navigator.geolocation.clearWatch(id);
		}
	}
})
.factory('elDatePicker',function($q){
	return {
		getDate:function(opts){
			var deferred = $q.defer();
			window.plugins.datePicker.show(opts,
				function success(date){
					deferred.resolve(date);
				});
			return deferred.promise;
		}
	}
})
.factory('elImagePicker',function($q){
	return {
		getPictures:function(opts){
			var deferred = $q.defer();
			window.imagePicker.getPictures(
				function success(pics){
					deferred.resolve(pics);
				}, 
	            function err(err){
	            	deferred.reject(err);
	            },opts);
			return deferred.promise;
		}
	}
})
.factory('elFileUtil',function($q,qWrap){
	var result =  {
		getFileChecksum:function(file){
			var deferred = $q.defer();
			if(typeof CryptoJS === 'undefined'){
			        console.log('CryptoJS is required.');
			        
			        return deferred.reject(new Error('CryptoJS is required.'));
			    }
			    var reader = new FileReader();
			    reader.onload = function (evt) {
			        console.log('getFileChecksum: reader finished loading');
			        
			        var arrayBuffer = evt.target.result;
			        var wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
			        var hash = CryptoJS.MD5(wordArray);
			        console.log('getFileChecksum: hash = '+hash);
			        
			        deferred.resolve(hash);
			    };
			    reader.onerror = function(anError){
			        console.log('getFileChecksum: reader error');
			        
			        deferred.reject(anError);
			    };
			    reader.readAsArrayBuffer(file);
			return deferred.promise;
		},
		moveFile:function(fileEntry,parent,filename){
			return qWrap(function(resolve,reject){
				fileEntry.moveTo(parent,filename,resolve,reject);
			});
		},
		getFile:function(fileEntry){
			return qWrap(function(resolve,reject){
				fileEntry.file(resolve,reject);
			});
		},
		getFileArrayBuffer:function(file){
			var deferred = $q.defer();
			var reader = new FileReader();
			reader.onload = function (evt) {
			    var arrayBuffer = evt.target.result;
			    deferred.resolve(arrayBuffer);
			};
			reader.onerror = function(anError){
			    deferred.reject(anError);
			};
			reader.readAsArrayBuffer(file);
			return deferred.promise;
		},
		getFilesystem:function(type){
			return qWrap(function(resolve,reject){
				window.requestFileSystem(type, 0, resolve,reject);
			});
		},
		resolveURL:function(url){
			return qWrap(function(resolve,reject){
				window.resolveLocalFileSystemURL(url,resolve,reject);
			});
		},
		getDirectory:function(dir,child,create,exclusive){
			return qWrap(function(resolve,reject){
				dir.getDirectory(child,{create:create,exclusive:exclusive},resolve,reject)
			});
		},
		getChildFileEntry:function(dir,childpath,create){
			var deferred = $q.defer();
			dir.getFile(childpath,{create:create},function(fileEntry){
				deferred.resolve(fileEntry);
			},function(err){
				deferred.reject(err);
			});
			return deferred.promise;
		},
		createWriter:function(fileEntry){
			return qWrap(function(resolve,reject){
				fileEntry.createWriter(resolve,reject);
			});
		}
	};
	return result;
})
.factory('elFoursquare',function($q,$http,elTokens){
	return {
		getNearbyVenues:function(location){
			var deferred = $q.defer();
			$http({
				method:'GET',
				url:'https://api.foursquare.com/v2/venues/search',
				params:{
					ll:(location.latitude+','+location.longitude),
					client_id:elTokens.foursquareClientId,
					client_secret:elTokens.foursquareClientSecret,
					v:elTokens.foursquareApiVersion
				}})
			.success(function(data, status, headers, config){
				console.log(data);
				deferred.resolve(data.response);
			})
			.error(function(data, status, headers, config){
				deferred.reject(data);
			});
			return deferred.promise;
		}
	}
})
.factory('elHTMLEscape',function(){
	var escapeEl = document.createElement('textarea');
	escapeHTML = function(html) {
	    escapeEl.textContent = html;
	    return escapeEl.innerHTML;
	};
	unescapeHTML = function(html) {
	    escapeEl.innerHTML = html;
	    return escapeEl.textContent;
	};
	return {
		escape:escapeHTML,
		unescape:unescapeHTML
	}
})
.factory('elStaticMap',function(){
	return {
		getURL:function(places){
			var url = 'https://maps.googleapis.com/maps/api/staticmap?size=500x500&scale=2&';
			function getLabel(idx){
				var labelstr = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
				return labelstr[idx%labelstr.length];
			}
			var markerStr = _.map(places,function(place,idx){
				var part = "markers=color:blue|label:"+getLabel(idx)+"|"+place.lat.toFixed(6)+","+place.lon.toFixed(6);
				return part;
			}).join('&');
			return (url + markerStr).replace(/\|/g,'%7C').replace(/&/g,'&amp;');
		}
	}
})
/*

Note structure in ENML:

<ul><li>
text1</li>
<li>text2</li>
<li>text3
...</li></ul><br><h3>Places</h3><ul>
<li>
<div>
<div><b>place.name</b></div>
<div><b>place.formattedAddress</b></div> //lines separated by <br>
<div style="display:none">place.id</div>
</div>
</li>
...
</ul><br><h3>Images</h3>
<en-media type="text/jpg" hash="image.hash">
...

 */
.factory('elEvernoteUtil',function($q,elFileUtil,elHTMLEscape,elStaticMap){
	return {
		toENML:function(text,places,images){
			var result = '<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE en-note SYSTEM \"http://xml.evernote.com/pub/enml2.dtd\"><en-note>'
				+'<ul><li>'
			+elHTMLEscape.escape(text).split('\n').join('</li><li>')
			+'</li></ul>';
			if(places.length>0){
				result+='<h3>Places</h3><ul>';
				result+=_.reduce(places,function(a,place){
					var tres = a
						+'<li><div>'
						+'<div><b>'+elHTMLEscape.escape(place.name)+'</b></div><div style="padding-left:2em">';
					if(place.location) tres+='<div>'+_.map(place.location.formattedAddress,elHTMLEscape.escape).join('<br/>')+'</div>';
					tres+='<div><i>'+place.lat+', '+place.lon+'</i></div>'
						+'</div></div></li>';
					return tres;
				},'');
				result+='</ul>';
				result+='<img style="width:500px;height:500px" src="' + elStaticMap.getURL(places) +'" />';
			}
			if(images.length>0){
				result+=
				'<h3>Images</h3>'
				+_.reduce(images,function(a,img){
					return a+'<en-media type="image/jpeg" hash="'+img.hash+'" />'+'<br/>';
				},'');
			}
			var jsonData = {
				text:text,
				places:_.map(places,function(place){
					var res = {
						name:place.name,
						id:place.id,
						lat:place.lat,
						lon:place.lon
					}
					if(place.location){
						res.location = {
							formattedAddress:place.location.formattedAddress,
							id:place.location.id,
						}
					}
					return res;
				}),
				images:_.map(images,function(img){
					var res = {
						hash:img.hash,
					}
					return res;
				}),
			}
			result += '<div style="display:none">' + elHTMLEscape.escape(JSON.stringify(jsonData)) + '</div>';
			result += '</en-note>';
			return result;
		},
		fromENML:function(enml){
			var jsonRegexp = /<div style="display:none">([^<]*)<\/div>/;
			var jsonDataStr = elHTMLEscape.unescape(jsonRegexp.exec(enml)[1]);
			var data = JSON.parse(jsonDataStr);
			return data;
		},
		createImageResource:function(imageUrl,hash){
			var deferred = $q.defer();
			var data = new Data();
			var resource = new Resource();
			elFileUtil.resolveURL(imageUrl)
				.then(elFileUtil.getFile)
				.then(elFileUtil.getFileArrayBuffer)
				.then(function(arrbuff){
					data.body = arrbuff;

					resource.mime = "image/jpeg";
					resource.data = data;

					deferred.resolve(resource);
				}).catch(function(err){
					deferred.reject(err);
				});
			return deferred.promise;
		},
		/*getPlaceResource:function(place){
			var data = new Data();
			var resource = new Resource();
			var resourceAttrs = new ResourceAttributes();

			var placeResourceContent = place.name + place.location?place.location.formattedAddress.join('\n'):"" + '\n' + place.lat + ', ' + place.lon;

			data.body = placeResourceContent;

			resourceAttrs.fileName = place.name;
			resourceAttrs.latitude = place.lat;
			resourceAttrs.longitude = place.lon;

			resource.mime = "text/plain";
			resource.data = data;
			resource.attributes = resourceAttrs;
			
			return resource;
		},*/
		hashArrayBuffer:function(arrayBuffer){
	        var wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
	        return CryptoJS.MD5(wordArray);
		}
	}
})
.factory('elEvernote',function(elTokens,elEvernoteUtil,elFileUtil,qWrap,$q){
	var _noteStore = null;
	function _getNoteStore(){
		if(_noteStore===null){
			var noteStoreTransport = new Thrift.BinaryHttpTransport(elTokens.evernoteNoteStoreURL);
			var noteStoreProtocol = new Thrift.BinaryProtocol(noteStoreTransport);
			_noteStore = new NoteStoreClient(noteStoreProtocol);
		}
		return _noteStore;
	}
	var _dailyLogNb = null;
	function _getDailyLogNb(){
		if(_dailyLogNb===null){
			var noteStore = _getNoteStore();
			return wrapEvernoteCall(function(resolveCb){
				noteStore.listNotebooks(elTokens.evernoteToken,resolveCb);
			}).then(function(nbs){
				var lognb = _.find(nbs,function(nb){
					return nb.name == "Daily Log";
				});
				console.log(lognb);
				if(lognb){
					_dailyLogNb = lognb;
					return lognb;
				} 
				else return wrapEvernoteCall(function(resolveCb){
					var newnb = new Notebook();
					newnb.name = "Daily Log";
					noteStore.createNotebook(elTokens.evernoteToken,newnb,resolveCb);
				}).then(function(nb){
					_dailyLogNb = nb;
					return nb;
				});
			});
		}else{
			var d = $q.defer();
			d.resolve(_dailyLogNb);
			return d.promise;
		}
	}

	window.addEventListener('error',handleEvernoteError);
	var curExceptionCount = 0;
	var curEvernoteDeferreds = [];
	function handleEvernoteError(errevt){
		var err = errevt.error;
		console.log("Error checker called with",errevt);
		if(err instanceof Thrift.TException){
			curExceptionCount++;
			console.log("Some Evernote call failed!");
			if(curExceptionCount > curEvernoteDeferreds.length){
				var err = new Error("Evernote calls were made without the async wrapper and not caught!");
				console.error(err);
				curExceptionCount=0;
				curEvernoteDeferreds=[];
				throw err;
			}else if(curExceptionCount == curEvernoteDeferreds.length){
				if(curEvernoteDeferreds.length == 1){
					curEvernoteDeferreds[0].reject(err);
					curExceptionCount=0;
					curEvernoteDeferreds=[];
				}else failRemaining();
			}
		}
	}
	function failRemaining(){
		if (curEvernoteDeferreds.length == 0){
			console.log("Yay! No calls failed!");
			curExceptionCount=0;
			curEvernoteDeferreds=[];
			return;
		} 
		else console.log("All ",curEvernoteDeferreds.length," remaining async Evernote calls must have failed!",curEvernoteDeferreds);
		curExceptionCount=0;
		_.each(curEvernoteDeferreds,function(deferred){
			deferred.reject(new Error("Unknown Evernote error!"));
		});
		curEvernoteDeferreds=[];
	}
	function wrapEvernoteCall(fn){
		var deferred = $q.defer();
		curEvernoteDeferreds.push(deferred);
		try{
			fn(function(data){
				//Successfully got data!
				if(data instanceof Thrift.TException || (data instanceof XMLHttpRequestProgressEvent && data.type=='error')){
					console.log("Evernote call returned an exception!");
					curEvernoteDeferreds = _.without(curEvernoteDeferreds,deferred);
					if(curExceptionCount == curEvernoteDeferreds.length){
						failRemaining();
					}
					deferred.reject(err);
				}else{
					console.log("Evernote call succeeded!", data);
					curEvernoteDeferreds = _.without(curEvernoteDeferreds,deferred);
					if(curExceptionCount == curEvernoteDeferreds.length){
						failRemaining();
					}
					deferred.resolve(data);
				}
			});
		}catch(err){
			if(err instanceof Thrift.TException){
				console.log("Evernote call failed synchronously!");
				curEvernoteDeferreds = _.without(curEvernoteDeferreds,deferred);
				deferred.reject(err);
			}else throw err;
		}
		console.log("Returning promise");
		return deferred.promise;
	}

	var elEvernote = {
		fetchNote:function(date){
			function pad(s,len,padval){
				str = ""+s;
				while(str.length<len){
					str = padval + str;
				}
				return str;
			}
			function getDateStr(d){
				return "" + d.getFullYear() + pad(d.getMonth()+1,2,'0') + pad(d.getDate(),2,'0');
			}
			var noteStore = _getNoteStore();
			var filter = new NoteFilter();

			var curdayStr = getDateStr(date);
			var tomorrowCutoff = new Date(date.getFullYear(), date.getMonth(), date.getDate()+1, 0, 0, 0, 0);

			filter.words = 'notebook:"Daily Log" created:'+curdayStr+' contentClass:com.hexahedria.everlog.dayentry';
			filter.order = NoteSortOrder.CREATED;
			filter.ascending = true;
			var spec = new NotesMetadataResultSpec();
			spec.includeCreated=true;

			return wrapEvernoteCall(function(resolveCb){
				noteStore.findNotesMetadata(elTokens.evernoteToken, filter, 0, 1, spec,resolveCb);
			}).then(function(foundNotes){
				if(foundNotes.notes.length == 0){
					return null;
				}
				var noteMeta = foundNotes.notes[0];
				if(noteMeta.created>tomorrowCutoff.getTime()){
					return null;
				}
				return wrapEvernoteCall(function(resolveCb){
					noteStore.getNote(elTokens.evernoteToken, noteMeta.guid, true,false,false,false,resolveCb);
				});
			});
		},
		saveNote:function(date,oldNote,text,images,places){

			var note = new Note();

			var attributes = new NoteAttributes();
			attributes.contentClass = "com.hexahedria.everlog.dayentry";
			note.attributes = attributes;
			
			var tempPromise;
			if(oldNote){
				note.guid = oldNote.guid;
				note.title = oldNote.title;
				var deletedHashes = _.pluck(_.filter(images,function(img){
					return img.dirty && !img.included;
				}),'hash');
				console.log(deletedHashes);
				note.resources = _.map(_.reject(oldNote.resources,function(resource){

					console.log("Comparing with ",resource.data.bodyHash,'->',Uint8toHex(resource.data.bodyHash));
					return _.contains(deletedHashes,Uint8toHex(resource.data.bodyHash));
				}),function(resource){
					var nresource = new Resource();
					nresource.guid = resource.guid;
					return nresource;
				});
				var tempDeferred =$q.defer();
				tempDeferred.resolve();
				tempPromise = tempDeferred.promise;
			}else{
				note.title = date.toDateString();
				note.resources = [];
				var daylen = 1000*60*60*24;
				var d = new Date(date.getTime());
				d.setHours(12);
				d.setMinutes(0);
				d.setSeconds(0);
				d.setMilliseconds(0);
				note.created = d;

				tempPromise = _getDailyLogNb().then(function(nb){
					console.log("Target nb:",nb);
					note.notebookGuid = nb.guid;
				});
			}
			var resultPromise = tempPromise.then(function(){
				
				var includedImages = _.filter(images,function(img){
					return img.included;
				});
				note.content = elEvernoteUtil.toENML(text,places,includedImages);
				console.log(note);

				var newImgs = _.filter(images,function(img){
					return img.dirty && img.included;
				});

				return $q.all(_.map(newImgs,function(img){
					return elEvernoteUtil.createImageResource(img.url, img.hash);
				}))
			}).then(function(newResources){
				console.log(newResources);
				note.resources = note.resources.concat(newResources);
				return wrapEvernoteCall(function(resolveCb){
					var noteStore = _getNoteStore();
					if(oldNote){
						console.log("Updating:",note);
						noteStore.updateNote(elTokens.evernoteToken,note,resolveCb);
					}else{
						console.log("Creating:",note);
						noteStore.createNote(elTokens.evernoteToken,note,resolveCb);
					}
				});
			});

			return resultPromise;
		},
		getResourceByHash:function(hash,noteGUID){
			if(!noteGUID) throw new Error("Cannot retrieve image without an associated note GUID!");
			var noteStore = _getNoteStore();
			var binaryhash = Uint8FromHex(hash);

			return wrapEvernoteCall(function(resolveCb){
				noteStore.getResourceByHash(elTokens.evernoteToken, noteGUID, binaryhash, true,false,false,false,resolveCb);
			});
		},
		loadImageIfNecessary:function(imagehash,noteGUID){
			var deferred = $q.defer();

			var parentdir;
			elFileUtil.getFilesystem(LocalFileSystem.TEMPORARY).then(function(fs){
				console.log("Filesystem: ",fs);
				return elFileUtil.getDirectory(fs.root,'images',true,false);
			}).then(function(imgdir){
				parentdir = imgdir;
				return elFileUtil.getChildFileEntry(imgdir,imagehash+'.jpg',false);
			}).then(function(fileEntry){
				//Exists!
				deferred.resolve(fileEntry);
			},function(){
				//Doesn't exist!
				var resource,fileEntry;
				return elEvernote.getResourceByHash(imagehash,noteGUID).then(function(r){
					resource=r;
					return elFileUtil.getChildFileEntry(imgdir,imagehash+'.jpg',true);
				})
				.then(function(entry){
					fileEntry=entry;
					return elFileUtil.createWriter(fileEntry);
				})
				.then(function(writer){
					writer.onwrite = function(evt) {
				        deferred.resolve(fileEntry);
				    };
				    writer.onerror = function(err){
				    	deferred.reject(err);
				    }
				    writer.write(resource.data.body);
				})
				.catch(function(err){
					deferred.reject(err);
				});
			});

			return deferred.promise;
		},
		debug:{
			wrapEvernoteCall:wrapEvernoteCall,
			getNoteStore:_getNoteStore,
			token:elTokens.evernoteToken,
			curEvernoteDeferreds:curEvernoteDeferreds
		}
	}
	return elEvernote;
})