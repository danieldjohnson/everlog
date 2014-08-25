angular.module('everlog.controllers', ['everlog.services'])

.controller('DayControl', function($scope, $timeout, $ionicPopover, $ionicPopup, $ionicModal,$ionicScrollDelegate,$q,elDatePicker,elImagePicker,elFileUtil,elFoursquare,elLocation,elEvernoteUtil,elEvernote) {
	var today = new Date();
	$scope.curdayDate;// = today;
	$scope.curdayDateStr;//= today.toDateString();
	$scope.curdayOldNote;
	$scope.curdayText={text:""};

	$scope.curdayImgs = [
	];

	$scope.curdayPlaces = [
	];

	$scope.locationAutodetect={active:true};
	$scope.lastLocation = null;
	$scope.lastPlaces = null;
	$scope.bestPlace = null;


	$scope.state={
		dirty:false,
		uploading:false,
		ready:false,
		working:0
	}

	function initialLoad(){ //called once at start
		var backup = localStorage.getItem('everlogBackup');
		if(backup && backup.length>0){
			var jsonData = JSON.parse(backup);
			console.log("Found backup!",jsonData);
			$scope.curdayDate = new Date(jsonData.date);
			$scope.curdayDateStr = $scope.curdayDate.toDateString();
			$scope.curdayOldNote = jsonData.oldNote;
			$scope.curdayText.text = jsonData.text;
			$scope.curdayPlaces = jsonData.places;
			$scope.curdayImgs = jsonData.images;
			$scope.state.dirty=true;
			$scope.state.ready=true;
		}else{	
			loadDate(today);
		}
	}
	function saveBackup(){ //called on pause
		if(!$scope.state.dirty||!$scope.state.ready){
			localStorage.setItem('everlogBackup','');
			return;
		}
		var jsonData = {
			date:$scope.curdayDate.getTime(),
			oldNote:$scope.curdayOldNote,
			text:$scope.curdayText.text,
			places:_.map($scope.curdayPlaces,function(place){
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
			images:$scope.curdayImgs
		};
		localStorage.setItem('everlogBackup',JSON.stringify(jsonData));
		console.log("Backing up state...",jsonData);
	}
	function loadDate(date){
	    $scope.state.ready=false;
		var lastDate = $scope.curdayDate;
		$scope.curdayDate = date;
		$scope.curdayDateStr = $scope.curdayDate.toDateString();
		return elEvernote.fetchNote(date).then(function(note){
			$scope.curdayOldNote = note;
			if(note){
				console.log("Loading from ",note);
				var oldData = elEvernoteUtil.fromENML(note.content);
				$scope.curdayText.text = oldData.text;
				$scope.curdayImgs = _.map(oldData.images,function(oldimg){
					var nimg = {
						url:null,
						dirty:false,
						hash:oldimg.hash,
						included:true,
					};
					elEvernote.loadImageIfNecessary(nimg.hash,note.guid).then(function(entry){
						nimg.url = entry.toURL();
					});
					return nimg;
				});
				$scope.curdayPlaces = oldData.places;
			}else{
				$scope.curdayText.text = "";
				$scope.curdayImgs = [];
				$scope.curdayPlaces = [];
			}
			$scope.state.dirty=false;
			$scope.state.ready=true;
			$ionicScrollDelegate.resize();
		},function(err){
			console.error(err);
			$ionicPopup.alert({title:"Could not load this day!"});
			if(lastDate === undefined) return;
			$scope.curdayDate = lastDate;
			$scope.curdayDateStr = $scope.curdayDate.toDateString();
			$scope.state.ready=true;
		});
	}
	$scope.pickDate=function(){
		function continuePickDate(){
			$scope.state.ready=false;
			elDatePicker.getDate({
	            date : $scope.curdayDate,
	            mode : 'date',
	            maxDate: today
	        }).then(function(returnDate) {
	        	console.log(returnDate);
	            if(returnDate === "" || isNaN( returnDate.getTime() )) {
	            	$scope.state.ready=true;
	            }else{
	                loadDate(returnDate);
	            }
	        });
		}
		if($scope.state.dirty){
			$ionicPopup.confirm({
				title:'Are you sure?',
				subTitle:'If you change dates now, you will lose your unsaved changes.',
				okText:'Change'
			}).then(function(shouldChange){
				if(shouldChange){
					continuePickDate();
				}
			});
		}else{
			continuePickDate();
		}
	}
	$scope.upload=function(){
		saveBackup();
		$scope.state.uploading=true;
		$scope.state.ready = false;
		elEvernote.saveNote($scope.curdayDate,$scope.curdayOldNote,$scope.curdayText.text,$scope.curdayImgs,$scope.curdayPlaces)
			.then(function(note){
				console.log("Saved to ",note);
				$scope.curdayImgs = _.filter($scope.curdayImgs,function(img){
					img.dirty=false;
					return img.included;
				});
				$scope.curdayOldNote = note;
				$scope.state.uploading=false;
				$scope.state.ready = true;
				$scope.state.dirty=false;
			});
	}
	$scope.markDirty=function(){
		$scope.state.dirty=true;
	}
	$scope.addImages=function(){
		function NoImagesError(message) {
		    this.name = 'NoImagesError';
		    this.message = message;
		    this.stack = (new Error()).stack;
		}
		NoImagesError.prototype = new Error;

		$scope.state.working++;
		elImagePicker.getPictures({
			width: 800, height:800
		}).then(function(pics){
			if(!pics || pics.length==0)
				throw new NoImagesError("No images selected");
			console.log("Got pics:",pics);

			return elFileUtil.getFilesystem(LocalFileSystem.TEMPORARY).then(function(fs){
				console.log("Filesystem: ",fs);
				return elFileUtil.getDirectory(fs.root,'images',true,false);
			}).then(function(imgdir){
				console.log("Image dir: ",imgdir);
				return $q.all(_.map(pics,function(pic){
					var tempentry, filehash;
					console.log("Starting img ",pic);
					picProcessedPromise = elFileUtil.resolveURL(pic).then(function(entry){
							tempentry = entry;
							return elFileUtil.getFile(tempentry);
						})
						.then(elFileUtil.getFileChecksum)
						.then(function(hash){
							console.log("Hash of pic ",pic,": ",hash+"");
							filehash = hash+"";
							console.log("  New name:",hash+'.jpg');
							return elFileUtil.moveFile(tempentry,imgdir,hash+'.jpg');
						})
						.then(function(entry){
							console.log(pic," moved to:",entry);
							return {fileEntry:entry, hash:filehash};
						});
					console.log("  promise is ",picProcessedPromise);
					return picProcessedPromise;
				}));
			});
		}).then(function(stuffs){
			console.log("Got stuffs:",stuffs);
			_.each(stuffs,function(stuff,idx){
				var fileEntry = stuff.fileEntry,
					hash = stuff.hash;
				$scope.curdayImgs.push({
					url:fileEntry.toURL(),
					dirty:true,
					hash:hash,
					included:true
				});
			});
			$scope.state.dirty=true;
		}).catch(function(err){
			if(!err instanceof NoImagesError){
				console.error(err);
				$ionicPopup.alert({title:"Could not get images."});
			}
		}).finally(function(){
			$ionicScrollDelegate.resize();
			$scope.state.working--;
		});
		
	}
	$scope.deleteImage=function(img,idx){
		if(img.dirty){
			$scope.curdayImgs.splice(idx,1);
		}else{
			img.included=false;
			img.dirty=true;
		}
		$scope.state.dirty=true;
		$ionicScrollDelegate.resize();
	}

	var watchNum=null;
	function cleanupWatchLocation(){
		if(watchNum!==null){
			elLocation.clearWatch(watchNum);
			watchNum=null;
		}
	}
	function setupWatchLocation(){
		$scope.bestPlace = null;
		$scope.lastPlaces=null;
		$scope.lastLocation=null;
		if(watchNum!==null) return;
		watchNum = elLocation.watchLocation(
			function success(coords){
				console.log(coords);
				$scope.lastLocation = coords;
				elFoursquare.getNearbyVenues(coords).then(function(data){
					console.log(data);
					$scope.bestPlace = data.confident ? data.venues[0] : null;
					$scope.lastPlaces = data.venues;
				});
			}, 
            function err(err){
            	console.error(err);
            });
	}
	$scope.$watch('locationAutodetect.active',function(newval){
		console.log("Autodetect change to",newval);
		if(newval){
			setupWatchLocation();
		}else{
			cleanupWatchLocation();
		}
	});
	$scope.$watch('state.ready',function(newval){
		console.log("Detected ready state change to ",newval);
		if(newval&&$scope.locationAutodetect.active){
			setupWatchLocation();
		}else{
			cleanupWatchLocation();
		}
	});
	document.addEventListener("pause",function(){
		console.log("Pausing");
		cleanupWatchLocation();
		saveBackup();
	});
	document.addEventListener("resume",function(){
		console.log("Resuming");
		if($scope.locationAutodetect.active) setupWatchLocation();
		updateMap();
		if($scope.ready&&$scope.state.working==0&&!$scope.state.dirty){
			loadDate($scope.curdayDate);
		}
	})

	$scope.detailPlace=function(place,$event){
		$scope.activePlace = place;
		$scope.placeDetailPopover.show($event);
	}
	$scope.detailPlaceHide=function(){
		$scope.placeDetailPopover.hide();
	}
	$scope.addPlace=function(){
		$scope.placeAddModal.show();
	}
	$scope.addBestPlace=function(){
		if(!$scope.locationAutodetect.active || $scope.bestPlace===null) return;
		var newplace = {
			name:$scope.bestPlace.name,
			location:$scope.bestPlace.location,
			lat:$scope.bestPlace.location.lat,
			lon:$scope.bestPlace.location.lng
		};
		$scope.curdayPlaces.push(newplace);
		$scope.locationAutodetect.active=false;
		$scope.state.dirty=true;
	}
	$scope.addPlaceHide=function(){
		$scope.placeAddModal.hide();
	}
	$scope.deletePlace=function(place,idx){
		$scope.curdayPlaces.splice(idx,1);
		$scope.state.dirty=true;
	}

	$ionicPopover.fromTemplateUrl('placeDetailPopover.html', {
	    scope: $scope
	}).then(function(Popover) {
	    $scope.placeDetailPopover = Popover;
	});
	$ionicModal.fromTemplateUrl('placeAddModal.html', {
	    scope: $scope,
	    animation:"slide-in-up"
	}).then(function(modal) {
	    $scope.placeAddModal = modal;
	});
	$ionicModal.fromTemplateUrl('bigMapModal.html', {
	    scope: $scope,
	    animation:"slide-in-up"
	}).then(function(modal) {
	    $scope.bigMapModal = modal;
	});
	//Cleanup the Popover when we're done with it!
	$scope.$on('$destroy', function() {
	  cleanupWatchLocation();
	  $scope.placeDetailPopover.remove();
	  $scope.placeAddModal.remove();
	  $scope.bigMapModal.remove();
	});

	var map = L.map('leafletmap',{
		dragging:false,
		touchZoom:false,
		scrollWheelZoom:false,
		doubleClickZoom:false,
		boxZoom:false,
		tap:false,
		keyboard:false,
		zoomControl:false
	});
	L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
			maxZoom: 15,
			attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
				'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
				'Imagery © <a href="http://mapbox.com">Mapbox</a>',
			id: 'examples.map-i86nkdio'
	}).addTo(map);
	var markers = [];

	function updateMap(){
		_.each(markers,function(m){
			map.removeLayer(m);
		});
		markers = _.map($scope.curdayPlaces,function(place,idx){
			return new L.Marker([place.lat,place.lon]).bindLabel(place.name, { noHide: true }).addTo(map);
		});
		$timeout(function(){
			centerOnMarkers(map);
		},10);
	}


	function centerOnMarkers(cmap){
		if($scope.curdayPlaces.length == 0) return;
		var latLngs = _.map($scope.curdayPlaces,function(place){
			return L.latLng(place.lat,place.lon);
		});
		if($scope.curdayPlaces.length==1){
			cmap.setView(latLngs[0],cmap.getMaxZoom());
		}else{
			var bounds = L.latLngBounds(latLngs);
			cmap.fitBounds(bounds,{padding:[20,20]});
		}
	}
	$scope.$watch("curdayPlaces", updateMap, true);
	$scope.showBigMap=function(){
		$scope.bigMapModal.show().then(function(){
			if(!$scope.bigMap){
				$scope.bigMap = L.map('modalmap');
			}
			$scope.bigMap.eachLayer(function(layer){
				$scope.bigMap.removeLayer(layer);
			});
			L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
				maxZoom: 18,
				attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
					'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
					'Imagery © <a href="http://mapbox.com">Mapbox</a>',
				id: 'examples.map-i86nkdio'
			}).addTo($scope.bigMap);
			_.each($scope.curdayPlaces,function(place,idx){
				var nmarker=new L.Marker([place.lat, place.lon]);
				nmarker.bindLabel(place.name, { noHide: true });
				nmarker.addTo($scope.bigMap);
			})
			$timeout(function(){centerOnMarkers($scope.bigMap);},0);
		});
	}
	$scope.bigMapHide=function(){
		$scope.bigMapModal.hide();
	}




	initialLoad();
})

.controller('placeAddControl', function($scope,$ionicLoading,$ionicPopup,$timeout,elLocation,elFoursquare){
	$scope.locationReady=false;
	$scope.$on('modal.shown',function(evt,cmodal){
		if(cmodal!=$scope.placeAddModal)return;
		if($scope.locationAutodetect.active && $scope.lastPlaces!==null){

			$scope.places = $scope.lastPlaces;
			$scope.location = $scope.lastLocation;
			console.log($scope.places);
			$scope.$watch('lastPlaces',function(nval){
				console.log(nval);
				$scope.places = nval;
				$scope.location = $scope.lastLocation;
			});
			$scope.locationReady=true;
		}else{
			$scope.locationReady=false;
			$ionicLoading.show({template:'Loading places...'});
			elLocation.getLocation().then(function(loc){
				console.log("Got location ",loc);
				$scope.location = loc;
				return elFoursquare.getNearbyVenues(loc);
			},function(err){
				console.log("Location error ",err);
				//$ionicLoading.hide(); //this will be called by the second error handler
				$scope.placeAddModal.hide();
				$ionicPopup.alert({title:"Could not detect your location."});
				throw err;
			}).then(function(data){
				console.log("Got foursquare data ",data);
				$scope.places = data.venues;
				$scope.locationReady=true;
				$ionicLoading.hide();
			},function(err){
				console.log("Got foursquare error ",err);
				$scope.places = [];
				$scope.locationReady=true;
				$ionicLoading.hide();
			});
		}
	})
	
	$scope.chooseLocation=function(name,loc){
		name = name || (loc&&loc.address) || ($scope.location.latitude+', '+$scope.location.longitude);
		var newplace = {
			name:name,
			location:loc,
			lat:$scope.location.latitude,
			lon:$scope.location.longitude
		};
		if(loc && loc.lat && loc.lng){
			newplace.lat = loc.lat;
			newplace.lon = loc.lng;
		}
		$scope.curdayPlaces.push(newplace);
		$scope.state.dirty=true;
		$scope.placeAddModal.hide();
		$scope.locationReady=false;
		$scope.locationAutodetect.active = false;
	}
	$scope.customLocation=function() {
		 $ionicPopup.prompt({
		   title: 'Where are you?',
		   inputType: 'text',
		   inputPlaceholder: 'Enter your location'
		 }).then(function(res) {
		 	console.log(res);
		 	if(res)
		   		$scope.chooseLocation(res,null);
		 });
	}
})
