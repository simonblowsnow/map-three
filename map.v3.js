function cout(obj){ console.log(obj); }




$(function(){
	
	var worldMap;
	var mouse = { x: 0, y: 0 };
	var mouseClient = { x: 0, y: 0 };
	var mouseY = 0;
	var citys = getCitys(), citys2 = getRailCitys();
	var infos = getCityInfo();
	var worldCitys = {};
	var cityInfo = {};
	citys.forEach(function(d){
		worldCitys[d[1]] = [d[1], d[4], d[3]];
	});
	citys2.forEach(function(d){
		worldCitys[d[0]] = d;
	});
	infos.forEach(function(d){
		//cityInfo[d[2]] = d;
	});


	function Map() {
		
		this.WIDTH       = window.innerWidth; 
		this.HEIGHT      = window.innerHeight;  
		
		this.VIEW_ANGLE  = 45;
		this.NEAR        = 0.1; 
		this.FAR         = 8000;
		this.CAMERA_X    = 0;
		this.CAMERA_Y    = 800;
		this.CAMERA_Z    = 0;
		this.CAMERA_LX   = 0;
		this.CAMERA_LY   = 0;
		this.CAMERA_LZ   = 0;
		this.cameraSpeed = 0.02;

		this.geo;
		this.scene = {};
		this.renderer = {};
		this.projector = {};
		this.camera = {};
		this.stage = {};
		this.countrys = {};
		this.countryList = [];
		//this.projection = null;
		this.citys = {};
		this.INTERSECTED = null;
		this.movePoints = [];
		this.worldCitys = worldCitys;
		this.cityInfo = cityInfo;
		this.railCityCache = {};

		this.NeedUpdateObject = {};
		this.commonObjects = {};
		// this.geoGenerator = null;
		this.testObj = null;
		this.Trains = [];
		this.mouseEvent = new ThreeMouseEvent(mouseClient);
		this.tooltips = new Tooltips();
		this.tooltipsTraffic = new TooltipsTraffic();

		var $this = this;

		this.Story = ThreeStory(this, mouseClient);

	}
	
	Map.prototype = {
		
		init_d3: function() {

			var geoConfig = function() {
				this.projection = d3.geo.equirectangular()  //mercator  naturalEarth() equirectangular
					.translate([500, 0])
					//.translate([520, 0])
					//.scale(230)
					.scale(220)
					//.scale(280)
					.rotate([-162.5, 0, 0]);

					//.rotate([-166, 0]);
				this.path = d3.geo.path().projection(this.projection);
			};
			this.geo = new geoConfig();

		},
		
		init_tree: function() {
			
			if( Detector.webgl ){
				this.renderer = new THREE.WebGLRenderer({ antialias : true, alpha: true });
				//// 设置3D背景颜色
				this.renderer.setClearColor( Config.color.ClearColor, 1 );		//1C1F55
			} else {
				this.renderer = new THREE.CanvasRenderer();
			}
			this.renderer.setSize( this.WIDTH, this.HEIGHT );

			$("#worldmap").append(this.renderer.domElement);

			this.scene = new THREE.Scene();
			// put a camera in the scene
			this.camera = new THREE.PerspectiveCamera(this.VIEW_ANGLE, this.WIDTH / this.HEIGHT, this.NEAR, this.FAR);
			this.camera.position.set(this.CAMERA_X, this.CAMERA_Y, this.CAMERA_Z);
			this.camera.lookAt( new THREE.Vector3(this.CAMERA_LX, this.CAMERA_LY, this.CAMERA_LZ) );
			this.scene.add(this.camera);
			var bgTexture = new THREE.TextureLoader().load("img/bg.jpg",
				function ( texture ) { } );
			this.scene.background = bgTexture;
			bgTexture.wrapS = THREE.MirroredRepeatWrapping;
			bgTexture.wrapT = THREE.MirroredRepeatWrapping;



			//// 测试效果
			//var cHelper = new THREE.CameraHelper( this.camera );
			////this.scene.add( cHelper );
			//var helper = new THREE.GridHelper( 1500, 50, 0xff0000, 0xffffff );
			////this.scene.add( helper );
			var controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
			//var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
			//var helper = new THREE.CameraHelper( this.camera );
			//this.scene.add( helper );



		},

		add_light: function(x, y, z, intensity, color) {
			var pointLight = new THREE.PointLight(color);
			pointLight.position.set(x, y, z);
			pointLight.intensity = intensity;
			this.scene.add(pointLight);
		},
		
		add_plain: function(x, y, z, color) {

			//return;
			//// 此处面板长度需和地图长度完整覆盖，比例需和标准官方地球贴图高度一致
			//// 故长度根据地图长度契合度调试，根据正规比例计算该处宽度
			//var x = 1454, y = 727, z = 30;//, color = 0xEEEEEE;
			var x = 1380, y = 690, z = 30;//, color = 0xEEEEEE;
			//// var planeGeo = new THREE.CubeGeometry(x, y, z);
			var planeGeo = new THREE.PlaneGeometry(x, y, z);
			var pic = new THREE.TextureLoader().load("img/worldMap1.jpg");
			var planeMat = new THREE.MeshLambertMaterial({color: color, map:pic});
			var plane = new THREE.Mesh(planeGeo, planeMat);

			// 版面原为水平放置， 旋转90度
			// rotate it to correct position
			plane.rotation.x = -Math.PI/2;
			plane.position.z = -70+5;
			plane.position.x = -24;
			plane.position.y = 20;

			//this.translate(plane);

			this.scene.add(plane);
			return plane;
		},
		add_rivers: function(data){
			var $this = this;
			data.geometries.forEach(function(d, m){
				var feature = $this.geo.path(d), shape = transformSVGPathExposed(feature);
				for (var j = 0 ; j < shape.length ; j++) {
					var points = shape[j].getPoints(150);
					var pts = points.map(function(d){
						var pt = new THREE.Vector3(d.x, 50, d.y);
						$this.translatePoint(pt);
						return pt;
					});

					var geometry = new THREE.TubeGeometry( new THREE.CatmullRomCurve3( pts ), 150, 0.1, 8, false );
					var line = new THREE.Mesh( geometry, new THREE.MeshPhongMaterial( { color: 0x5C5C5C } ) );
			        $this.scene.add(line);
				}
			});

			//// 中国南海
			var SouthSea = [
				[[109.3035,16.1944],[109.4921,15.9721],[109.6576,15.7227],[109.7864,15.4374],[109.8600,15.1695]],
				[[110.3199,12.2378],[110.3107,11.9073],[110.2463,11.5991],[110.1268,11.3314],[109.9888,11.1407]],
				[[108.2341,7.0776],[108.2019,6.8018],[108.2065,6.5074],[108.2479,6.2175],[108.3077,6.0104]],
				//[[109.1172,6.2129],[112.0746,3.4772],[112.3827,3.5465],[112.6127,3.6343],[112.8657,3.7498]],
				[[111.80, 3.41],[112.0746,3.4772],[112.3827,3.5465],[112.8657,3.7498]],
				[[115.5517,7.1603],[115.8828,7.5506],[116.2554,7.9818]],
				[[118.5412,10.9090],[118.6378,11.0680],[118.8080,11.4267],[118.9046,11.6989],[118.9828,11.9843]],
				[[119.0656,15.0087],[119.0656,15.5221],[119.0656,16.0344]],
				[[119.4749,18.0123],[119.5853,18.2454],[119.6589,18.3772],[119.8704,18.7676],[120.0222,19.0259]],
				[[120.0222,19.0259],[121.5676,21.2844],[121.9217,21.7062]],
				[[122.5150,23.4659],[122.6346,23.9318],[122.7542,24.4086]]
			];
			SouthSea.forEach(function(item){
				var pts = item.map(function(d){
					var pt = $this.geo.projection([d[0], d[1]]), vector = new THREE.Vector3(pt[0], 45, pt[1]);
					$this.translatePoint(vector);
					return vector;
				});

				var geometry = new THREE.TubeGeometry( new THREE.CatmullRomCurve3( pts ), 150, Config.border.SouthSea, 8, false );
				var line = new THREE.Mesh( geometry, new THREE.MeshPhongMaterial( { color: Config.color.ChinaBoder } ) ); //0x1091ff
				$this.scene.add(line);

			});
		},
		add_countries: function(data) {
			//// cout(new Date());
			var lineMaterial = new THREE.LineBasicMaterial( { color: Config.color.Country, linewidth: Config.border.Country } ); //4AC8F4
			var $this = this, shapeAll = [];
			for (var i = 0 ; i < data.features.length ; i++) {
				var geoFeature = data.features[i], feature = this.geo.path(geoFeature);

				//// Geo核心转换
				var shapes = transformSVGPathExposed(feature);
				for (var j = 0 ; j < shapes.length; j++) {
					shapeAll.push(shapes[j]);
					var name = ('properties' in geoFeature) ? geoFeature.properties.name : '';

					var lineGeometry = new THREE.Geometry().setFromPoints( shapes[j].getPoints(250) );
					var outline = new THREE.Line( lineGeometry, lineMaterial );
					outline.rotation.x = Math.PI/2;
					outline.position.y = 0;
					this.translate(outline);
					this.scene.add(outline);
					//// this.countryList.push(country);
				}

			}

			/*
			var extrusionSettings = {
				amount: 1, bevelEnabled: false,
				bevelThickness: 0.5, bevelSize: 0.5,
				bevelSegments: 8, material: 0, extrudeMaterial: 1,
				UVGenerator: THREE.ExtrudeGeometry.BoundingBoxUVGenerator
			};
			var geometry = new THREE.ExtrudeGeometry(shapeAll, extrusionSettings);

			//// 卫星地表贴图
			var texture = new THREE.TextureLoader().load("img/worldMap1.jpg");   //worldMap1
			var geometry = new THREE.ExtrudeGeometry(shapeAll, extrusionSettings);  //{ amount: 2, bevelEnabled: false }
			geometry.computeBoundingBox();
			var box = geometry.boundingBox;
			var p = 2, offsetY = -70, W = box.max.x - box.min.x, H = W / p, minY = -H / 2 + offsetY;

			var uvs = geometry.faceVertexUvs[0];
			for(var i = 0; i < uvs.length; i++){
				for(var j = 0; j < uvs[i].length; j++){
					u = uvs[i][j];
					u.x = (u.x - box.min.x) / W;
					u.y = 1 - (u.y - minY) / H;
				}
			}
			texture.magFilter = THREE.NearestFilter;

			var normalConfig = { map:texture, //color: Config.color.Country,
				color:0xFFFFFF,
				specular:0xffffff,
				shininess:10, //ambient:0xffffff,
				//emissive:0x133245,
				emissive:0x000000,
				opacity: Config.opacity.Country, transparent:false };  // transparent:true  map:texture, , wireframe:true
			var country = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial(normalConfig));
			//// var country = new THREE.Mesh(geometry, getShaderMaterial(texture));

			//// 备选 MeshPhongMaterial MeshLambertMaterial MeshBasicMaterial

			country.rotation.x = Math.PI / 2;
			country.position.y = 0;
			this.translate(country);
			this.scene.add(country);
			cout(new Date());
			*/
		},

		add_China: function(data) {
			cout(new Date());
			var chinaConfig = { color: Config.color.China, opacity: Config.opacity.China, transparent:true }; //FF7F50 0.65
			var chinaMaterial = new THREE.MeshPhongMaterial(chinaConfig);
			var extrusionSettings = {
				amount: 1, bevelEnabled: false,
				bevelThickness: 0.5, bevelSize: 0.5,
				bevelSegments: 8, material: 0, extrudeMaterial: 1,
				UVGenerator: THREE.ExtrudeGeometry.BoundingBoxUVGenerator
			};
			var $this = this;
			var geoFeature = data.features[data.features.length - 1], feature = this.geo.path(geoFeature);

			//// Geo核心转换
			var shapes = transformSVGPathExposed(feature);
			for (var j = 0 ; j < shapes.length; j++) {
				var shape3d = new THREE.ExtrudeGeometry(shapes[j], extrusionSettings);
				var country = new THREE.Mesh(shape3d, chinaMaterial);
				country.name = name;
				country.rotation.x = Math.PI/2;
				country.position.y = 1;
				this.translate(country);
				this.scene.add(country);
				if(j>=geoFeature.geometry.coordinates.length)continue;
				//// 轮廓
				var pts = geoFeature.geometry.coordinates[j][0].map(function(d){
					var pt = $this.geo.projection([d[0], d[1]]), vector = new THREE.Vector3(pt[0], 46, pt[1]);
					return $this.translatePoint(vector);
				});
				var curve = new THREE.CatmullRomCurve3(pts);
				var borderGeometry = new THREE.TubeGeometry( curve, 1024, Config.border.China, 32, false );
				var borderMaterial = new THREE.MeshBasicMaterial( { color: Config.color.ChinaBoder } );
				var border = new THREE.Mesh( borderGeometry, borderMaterial );
				this.scene.add(border);
			}
		},
		addPoint: function(pos, color, power, img){
			pos = pos || new THREE.Vector3(0, 0, 0);
			power = power || 600;
			color = color || 0xffffff;
			var light = new THREE.PointLight( color, 1, power );
			var texture = (new THREE.TextureLoader()).load("img/" + (img || "corona") + ".png");

			var lensFlare = new THREE.LensFlare(texture, 60, 0, THREE.AdditiveBlending, new THREE.Color(color));
			light.position.copy(pos);
			lensFlare.position.copy(light.position);
			this.scene.add(lensFlare);
			return lensFlare;
		},
		addMoveObject: function(mesh, obj){
			//this.scene.add(mesh);
			//this.NeedUpdateObject.push(obj);
		},

		translate: function(obj){
			obj.translateX(-524);
			//obj.translateX(-524);
			//obj.translateX(-490);

			obj.position.y += 70;
			obj.translateZ(50);
			//obj.translateY(-50);
		},
		translatePoint: function(pos){
			//pos.x -= 490;
			pos.x -= 524;

			//cout(pos.y);
			pos.y -= 25;
			//pos.z += 50;
			return pos;
		},
		translate2: function(obj){
			obj.translateX(-490);
			obj.translateZ(50);
			obj.translateY(20);
		},

		move: function (){
			for( var key in this.NeedUpdateObject){
				this.NeedUpdateObject[key].update();

			}
		},
		addObjects: function(objects, key, type){
			var $this = this;
			objects.forEach(function(obj, i){
				$this.addObject(obj, key + i, type);

				if(obj.geometry)obj.geometry.center();
			});
		},
		addObject:function(obj, key, type){
			if(!(type in this.commonObjects))this.commonObjects[type] = {};
			this.commonObjects[type][key] = {"object":obj, "visiable":1};
			this.scene.add(obj);
		},
		addObjectTo:function(obj, key, type, pos){
			if(!(type in this.commonObjects))this.commonObjects[type] = {};
			this.commonObjects[type][key] = {"object":obj, "visiable":1};
			obj.addTo(this.scene, pos);
		},
		preStory: function(){
			this.removeObject("railCity");
			this.removeObject("railWay");
			//this.recoverObject("railWay", "railCenter");
			//this.removeObject("railWay");
			this.removeObject("staticRailWay");
			this.removeObject("plane");
			this.removeObject("moveSun");
		},
		tellStory: function(){
			var $this = this;

			this.Trains.forEach(function(d){
				if($this.NeedUpdateObject["growLine" + d.name].progress > d.progress[d.index]){
					var city = d.data[d.index];
					if(d.index <= d.progress.length && !(city in $this.Story.cacheMark)){
						if(city!="成都" && !(city in $this.hideTxt))$this.recoverObject("railCity", "city" + city);
						$this.Story.cacheMark[city] = 1;
						if(d.index>0 && !(city in $this.hideTxt))$this.addObjectTo( $this.NeedUpdateObject["textCity" + city] );
						if(city=="阿拉山口")$this.NeedUpdateObject["growLine" + "railSouth"].stop = false;
					}

					d.index++;
				}
			});
			//cout(this.Story.initMousePos);
			//this.commonObjects["railCity"]["city乌鲁木齐"].visiable = false;

			/// cout(this.NeedUpdateObject["growLine" + "railCenter"].progress);

			/*
			[["sun成都", "sun北京",...], "sun"],
			[["staticrailCenter", "staticrailSouth",...], "staticRailWay"],
			[["railCenter", "railSouth",...], "railWay"],
			[["stars"], "stars"],
			[["plane纽约", "plane洛杉矶",...], "plane"],
			[["moveSun纽约", "moveSun洛杉矶",...], "moveSun"],
			[["city兰州", "city乌鲁木齐",...], "railCity"]
			*/
			// this.removeObject("sun", "sun成都"); 暂不处理

		},

		//// private
		_removeObject: function(type, key){
			if(this.commonObjects[type][key].object && this.commonObjects[type][key].visiable==1){
				this.commonObjects[type][key].visiable = 0;
				this.commonObjects[type][key].object.visible = false;
				//cout([type, key]);
				//this.scene.remove(this.commonObjects[type][key].object);
				//cout(this.commonObjects);
			}
		},
		//// private
		_recoverObject: function(type, key){
			if(this.commonObjects[type][key].object && this.commonObjects[type][key].visiable==0){
				this.commonObjects[type][key].visiable = 1;
				this.commonObjects[type][key].object.visible = true;
				//this.scene.add(this.commonObjects[type][key].object);
			}
		},
		//// 恢复物体，支持恢复整个类别
		recoverObject: function(type, key){
			if(!(type in this.commonObjects)) return;

			if(key==undefined){
				for(var k in this.commonObjects[type])this._recoverObject(type, k);
			}else{
				this._recoverObject(type, key);

			}
		},
		//// 移除物体，支持移除整个类别
		removeObject: function(type, key){
			if(!(type in this.commonObjects)) return;

			if(key==undefined){
				for(var k in this.commonObjects[type])this._removeObject(type, k);
			}else{
				this._removeObject(type, key);
			}
		},

		addCitys: function(){
			var $this = this;
			//this.addCenter();
			//var railCityCache = {};
			cout([new Date(), "begin addCitys"]);


			////// 三条蓉欧铁路
			var railWay1 = [ "成都", "宝鸡", "兰州", "吐鲁番", "乌鲁木齐", "阿拉山口", "阿克斗卡", "阿斯塔纳",
				"叶卡捷琳堡", "莫斯科", "布雷斯特", "华沙", "布拉格", "纽伦堡", "法兰克福", "鹿特丹"
			];
			var railWay2 = [ "阿拉山口", "霍尔果斯", "热特肯", "阿拉木图", "塔什干", "吉扎克", "捷詹", "德黑兰",
				"锡瓦斯", "索菲亚", "布达佩斯", "罗兹", "格拉茨", "米兰", "巴塞尔", "巴黎", "鹿特丹"
			];
			var railWay3 = [ "宝鸡", "西安", "大同", "二连浩特", "乌兰巴托", "乌兰乌德", "泰舍特", "新西伯利亚", "叶卡捷琳堡"
				// , "莫斯科", "布雷斯特", "华沙", "布拉格", "纽伦堡", "法兰克福", "鹿特丹"
			];


			var rails = {
				'railCenter':[ "成都", "宝鸡", "兰州", "吐鲁番", "乌鲁木齐", "阿拉山口", "阿克斗卡", "阿斯塔纳",
					"叶卡捷琳堡", "莫斯科", "布雷斯特", "华沙", "布拉格", "纽伦堡", "法兰克福", "鹿特丹"],
				'railSouth':[ "阿拉山口", "霍尔果斯", "热特肯", "阿拉木图", "塔什干", "吉扎克", "捷詹", "德黑兰",
					"锡瓦斯", "索菲亚", "布达佩斯", "罗兹", "格拉茨", "米兰", "巴塞尔", "巴黎", "鹿特丹"],
				'railNorth':[ "宝鸡", "西安", "大同", "二连浩特", "乌兰巴托", "乌兰乌德", "泰舍特", "新西伯利亚", "叶卡捷琳堡"],

				'rShanghai':['成都', '安康', '十堰', '武汉', '合肥', '南京', '苏州', '上海'],
				'rNingbo':['成都', '安康', '十堰', '武汉', '杭州', '宁波'],
				'rXiamen':['成都', '长沙', '厦门'],
				'rShenzhen':['成都', '宜宾', '贵阳', '桂林', '贺州', '广州', '深圳'],
				'rDeheilan':['成都', '广通', '昆明', '山腰', '河内', '荣市', '广治', '广义', '芽庄', '藩切', '胡志明市', '金边',
					'曼谷', '直通', '仰光', '曼德勒', '吉大港', '达卡', '加尔各答', '占西', '新德里', '拉合尔', '奎达', '克尔曼', '德黑兰'],
				'rXinjiapo':['昆明', '磨憨', '万象', '曼谷', '叻武里', '华欣', '春蓬', '宋卡', '槟城', '吉隆坡', '新加坡'],
				'rMandele':['广通', '瑞丽', '曼德勒']
			};


			var planeCitys = [["纽约"], ["洛杉矶"], //"", '里约热内卢',
				["旧金山"], ["华盛顿市"], ["温哥华"], ["圣保罗"], ["阿根廷"],
				["巴黎"], 
				["伦敦"], ["莫斯科"],
				["法兰西堡"], ["柏林"], ["伯尔尼"], ["开罗"], 
				["内罗毕"],
				["德黑兰"], ["德黑兰", "米兰"],
				["阿尔及尔"]
			];
			var plans = [['阿姆斯特丹', '阿姆斯特丹'],['阿姆斯特丹', '阿姆斯特丹'],['阿姆斯特丹', '阿姆斯特丹'],['阿姆斯特丹', '阿姆斯特丹'],['伦敦', '伦敦'],['法兰克福', '法兰克福'],['法兰克福', '法兰克福'],['莫斯科', '莫斯科'],['伊尔库茨克', '伊尔库茨克'],['巴黎', '巴黎'],['布拉格', '布拉格'],['马德里', '马德里'],['马德里', '马德里'],['旧金山', '旧金山'],['旧金山', '旧金山'],['洛杉矶', '洛杉矶'],['纽约', '纽约'],['阿布扎比', '阿布扎比'],['阿布扎比', '阿布扎比'],['阿布扎比', '阿布扎比'],['阿布扎比', '阿布扎比'],['迪拜', '迪拜'],['多哈', '多哈'],['加德满都', '加德满都'],['加德满都', '加德满都(拉萨经停)'],['加德满都', '加德满都'],['科伦坡', '科伦坡'],['首尔', '首尔'],['首尔', '首尔'],['首尔', '首尔'],['首尔', '首尔'],['首尔', '首尔'],['济州岛', '济州岛'],['东京', '东京'],['东京', '东京'],['东京', '东京'],['东京', '东京'],['大阪', '大阪'],['大阪', '大阪'],['墨尔本', '墨尔本'],['悉尼', '悉尼'],['悉尼', '悉尼'],['奥克兰', '奥克兰'],['吉隆坡', '吉隆坡'],['吉隆坡', '吉隆坡'],['新加坡', '新加坡'],['新加坡', '新加坡'],['新加坡', '新加坡'],['新加坡', '新加坡'],['新加坡', '新加坡'],['新加坡', '新加坡'],['新加坡', '新加坡'],['新加坡', '新加坡'],['芽庄', '芽庄'],['芽庄', '芽庄'],['芽庄', '芽庄'],['河内', '河内'],['岘港', '岘港'],['岘港', '岘港'],['琅勃拉邦', '琅勃拉邦'],['曼谷', '曼谷'],['曼谷', '曼谷'],['曼谷', '曼谷（经停深圳）'],['曼谷', '曼谷'],['曼谷', '曼谷'],['曼谷', '曼谷'],['万伦', '万伦'],['苏梅岛', '苏梅岛'],['普吉', '普吉'],['普吉', '普吉'],['普吉', '普吉'],['甲米', '甲米'],['甲米', '甲米'],['清迈', '清迈'],['清迈', '清迈'],['巴厘岛', '巴厘岛'],['暹粒', '暹粒'],['暹粒', '暹粒'],['暹粒', '暹粒'],['路易港', '路易港'],['路易港', '路易港'],['亚德斯亚贝巴', '亚德斯亚贝巴'],['加德满都', '加德满都（经停拉萨）'],['加德满都', '加德满都'],['科伦坡', '科伦坡'],['马累', '马累（经停曼谷）'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['香港', '香港'],['澳门', '澳门'],['澳门', '澳门'],['澳门', '澳门'],['台北', '台北'],['台北', '台北'],['台北', '台北'],['高雄', '高雄']]

			var pointCitys = [];
			var pointTrains = [];

			//// 铁路数据及效果配置
			var c = Config.color;
			this.Trains = [
				{ name:"railCenter", data:railWay1, progress:[], index:0, width:1.3, colors:[c.railCenter, "#fff"], timeDis:100 },
				{ name:"railSouth", data:railWay2, progress:[], index:0, width:0.8, colors:[c.railSouth, "#fff"], timeDis:100 },
				{ name:"railNorth", data:railWay3, progress:[], index:0, width:1, colors:[c.railNorth, "#fff"], timeDis:50  },

				{ name:"rShanghai", data:rails['rShanghai'], progress:[], index:0, width:0.8, colors:[c.railChina, "#fff"], timeDis:50  },
				{ name:"rNingbo", data:rails['rNingbo'], progress:[], index:0, width:0.8, colors:[c.railChina, "#fff"], timeDis:50  },
				{ name:"rXiamen", data:rails['rXiamen'], progress:[], index:0, width:0.8, colors:[c.railChina, "#fff"], timeDis:50  },
				{ name:"rShenzhen", data:rails['rShenzhen'], progress:[], index:0, width:0.8, colors:[c.railChina, "#fff"], timeDis:50  },
				{ name:"rDeheilan", data:rails['rDeheilan'], progress:[], index:0, width:0.8, colors:[c.railAsia, "#fff"], timeDis:50  },
				{ name:"rXinjiapo", data:rails['rXinjiapo'], progress:[], index:0, width:0.8, colors:[c.railAsia, "#fff"], timeDis:50  },
				{ name:"rMandele", data:rails['rMandele'], progress:[], index:0, width:0.8, colors:[c.railAsia, "#fff"], timeDis:50  },
			];

			//// 字体偏移设置
			var txtOffset = {
				"德黑兰":[13, -14], "捷詹":[10, -15], "锡瓦斯":[12, -12], "吉扎克":[15, -15], "塔什干":[20, 7],
				"索菲亚":[-5, -3], "布达佩斯":[-5, -3], "格拉茨":[10, -12], "米兰":[10, -12], "巴塞尔":[20, -6, 4],
				"华沙":[4, 6, 4], "罗兹":[15, 5, 5], "布雷斯特":[-5, -10], "阿拉木图":[13, -7, 3], "吐鲁番":[5, 5, 2], "阿拉山口":[0, 3, 3],
				"阿斯塔纳":[-5, 0], "阿克斗卡":[-2, 5], "热特肯":[16, 6], "霍尔果斯":[8, -8, 3], "莫斯科":[15, 10],
				"兰州":[-2, 3, 2], "西安":[-3, 5], "宝鸡":[4, 6], "大同":[10, -2, 2], "二连浩特":[-4, -2, 3], "乌兰巴托":[-4, -2],
				"叶卡捷琳堡":[20, 10], "新西伯利亚":[20, 8], "乌兰乌德":[-4, -2], "泰舍特":[-5, 1], "巴黎":[18, -3],
				"法兰克福":[13, -8, 3], "鹿特丹":[13, 8], "纽伦堡":[5, 6, 3], "布拉格":[5, 6, 3], "乌鲁木齐":[6, 4, 2],
				"广通":[10, -1, 2], "加尔各答":[15, -8], "新德里":[20, -5], "拉合尔":[12, -8], "曼德勒":[18, -7], "昆明":[-2, -2, 2],
				"宁波":[-3, -2, 2], "武汉":[2, 3, 2], "南京":[2, 3, 2], "上海":[-3, 0, 2], "深圳":[-3, 0, 2], "杭州":[4, -5, 2],
				"广州":[-2, 1, 2], "厦门":[-2, 0, 2],
				"首尔":[-3, 0, 4], "东京":[-3, 0, 4], "台北":[-3, 0, 3], "香港":[0, -3, 2], "青岛":[-2, -3, 2], "天津":[-2, -2, 2],
				"澳门":[3, -4, 2], "北京":[3, 2, 3],
				"山腰":[10, -6]
				//"布雷斯特":[15, -15], "德黑兰":[15, -15], "德黑兰":[15, -15], "德黑兰":[15, -15], "德黑兰":[15, -15]
			};
			this.hideTxt = {"荣市":1, "广治":1, "广义":1, "芽庄":1, "藩切":1, "胡志明市":1, "吉大港":1, "占西":1,
				"奎达":1, "克尔曼":1, "叻武里":1, "华欣":1, "春蓬":1, "宋卡":1, "槟城":1, "贺州":1, "十堰":1, "安康":1,
				"合肥":1, "桂林":1, "贵阳":1, "西安":1, "宜宾":1, "长沙":1, "直通":1, "苏州":1, "":1};
			////// 铁路综合效果 //////
			this.Trains.forEach(function(item, i){
				pointTrains.push([]);
				item.data.forEach(function(c, j){
					var pt = $this.geo.projection([$this.worldCitys[c][1], $this.worldCitys[c][2]]);
					var vector = new THREE.Vector3(pt[0], 50, pt[1]); //46
					//// 城市信息补全
					if(!(c in $this.worldCitys)){
						//$this.worldCitys[d[0]] = [$this.cityInfo[d[0]][3], d[0], $this.cityInfo[d[0]][0], d[2], d[1]];
					}
					$this.translatePoint(vector);
					pointTrains[i].push(vector);
					//// 增加城市标示
					if(!(c in $this.railCityCache)){
						$this.railCityCache[c] = vector;
						// 文字
						if(!(c in $this.hideTxt)){
							var pos = vector.clone(), size = 4;
							if(c in txtOffset){
								pos.sub( new THREE.Vector3(txtOffset[c][0], 0, txtOffset[c][1]) );
								if(txtOffset[c].length>2)size = txtOffset[c][2];
							}
							var txt = new ThreeText.BasicText(c, size, null, 0, pos, 0xffffff);
							var make = new ThreePoint.PointCircleMake(new THREE.Vector3(vector.x, vector.y + 2, vector.z), 0.6);
							$this.addObject(make.object, "city" + c, "railCity");
							$this.NeedUpdateObject["textCity" + c] = txt;
						}
						// if(d[0]!="成都")$this.addObjectTo(txt, 'city' + d[0], 'textCity', pos);
					}

					//// 记录点在曲线中的位置·初始化
					var _curve = new THREE.CatmullRomCurve3( pointTrains[i] );
					item.progress.push( pointTrains[i].length<2 ? 0 : _curve.getLength());
				});

				//// 静态线路 ////
				//var line2 = new ThreeLine.Line(pointTrains[i], 0xDEB887);
				//$this.addObject(line2, "static" + item.name, "staticRailWay");
				////// 铁路动效 //////
				var mLine = new ThreeLine.LineRailMove(pointTrains[i], item.width, 300, item.colors);
				mLine.stop = true;
				$this.addObject(mLine.object, item.name, "railWay");
				$this.NeedUpdateObject["railWay" + item.name] = mLine;
				//// 线增长动效 ////
				var gLine = new ThreeGlow.GlowLineMove(pointTrains[i], item.width * 0.85, 0xFFEC8B, 50, 2 * item.width);
				gLine.stop = true;
				gLine.timeDis = item.timeDis;
				$this.addObject(gLine.object, item.name, "growLine");
				//$this.addObject(gLine.GlowOut, item.name, "growLineOut");
				//$this.addObject(gLine.line, item.name, "growLine");
				$this.NeedUpdateObject["growLine" + item.name] = gLine;

				//// 记录城市实际坐标值 ////
				var totalLength = gLine.curve.getLength();
				item.progress.forEach(function(d, idx){
					item.progress[idx] = item.progress[idx] / totalLength;
				});
			});

			cout(new Date());

			//// 城市散点准备 ////
			for(var name in $this.worldCitys){
				var d = $this.worldCitys[name];
				//var pt = this.geo.projection([d[4], d[3]]);
				//var vector = new THREE.Vector3(pt[0], 50, pt[1]);
				var pt = this.geo.projection([d[1], d[2]]);
				var vector = new THREE.Vector3(pt[0], 50, pt[1]);
				this.translatePoint(vector);
				this.citys[name] = vector;
				pointCitys.push(vector);
			}
			////// 城市星星闪烁效果 //////
			/*
			var ps = new PointStar(pointCitys);
			//this.addObject(ps.object, "stars", "stars");
			this.NeedUpdateObject["stars"] = ps;
			*/

			////// 航线效果 //////
			plans.forEach(function(d, k){
				if(!(d[0] in $this.citys)) return ;
				var src, tar;
				//if(d.length==2){
				//	src = $this.citys[d[0]];
				//	tar = $this.citys[d[1]];
				//}else{
				//	src = $this.citys["成都"];
				//	tar = $this.citys[d[0]];
				//}
				src = $this.citys["成都"];
				tar = $this.citys[d[0]];

				//// PointCircle PointGraph
				var pg = new ThreePoint.PointCircle(new THREE.Vector3(tar.x, tar.y - 1, tar.z), Config.color.planeCity, 0.25, '', 0xF08080);
				$this.addObject(pg, "planeCity" + d[0], 'planeCity');

				// var src = $this.citys["成都"], tar = $this.citys[d];
				var lineCurve =  new ThreeLine.BezierCurve(src, tar, 0xFFE4B5);

				//// 航线使用光效线条
				var gLine = new ThreeGlow.GlowLineEx(lineCurve.curve, 0.1, 0xFFFFE0);
				gLine.stop = true;
				gLine.loop = true;
				$this.addObject(gLine.object, "plane" + d[0], "plane");
				$this.NeedUpdateObject["plane" + d[0]] = gLine;
				//$this.addObject(gLine.GlowOut, "planeOut" + d, "plane1");
			});

			//// 航班线路
			var citys1 = ['北京', '上海', '广州', '深圳', '杭州', '南京', '青岛', '',
				'', '香港', '澳门', '', '厦门', '大同', '首尔', '东京', '台北'
			];
			citys1.forEach(function(c){
				if(!(c in $this.citys)) return ;
				var src = $this.citys["成都"],	tar = $this.citys[c], pt = new THREE.Vector3(tar.x, tar.y - 2, tar.z);
				
				var pg = new ThreePoint.PointCircle(pt, Config.color.planeCity, 0.25, '');
				$this.addObject(pg, "planeCity" + c, 'planeCity');
				//// 文字
				if(c in txtOffset){
					var pos = pt.clone(), size = txtOffset[c][2];
					pos.sub( new THREE.Vector3(txtOffset[c][0], 0, txtOffset[c][1]) );
					var txt = new ThreeText.BasicText(c, size, null, 0, pos, 0xffffff);
					$this.addObjectTo(txt, 'city' + c, 'textPlaneCity', pos);
				}

				var lineCurve =  new ThreeLine.BezierCurve(src, pt, Config.color.planeLine);
				$this.addObject(lineCurve.object, "planeChina" + c, "planeChina");
				var pm = new ThreePoint.PointMove(lineCurve.curve);
				$this.addObject(pm.object, "moveSun" + c, "moveSunChina");
				$this.NeedUpdateObject["moveSun" + c] = pm;

			});

			////// 预备动画 //////
			this.preStory();

			//// 成都·中心文字 ////
			var txt = new ThreeText.BasicText("成都", 8, -Math.PI/2, 1, null, 0xff0000, true);
			var pos = $this.citys["成都"].clone().sub( new THREE.Vector3(10, 0, -15 ));
			$this.addObjectTo(txt, 'city' + d[0], 'textCity', pos);
			var center = new ThreePoint.PointCenter($this.citys["成都"], 1);
			this.scene.add(center.object);
			$this.NeedUpdateObject["center"] = center;
			
			//// 添加鼠标事件 ////
			//this.addMouseEvent();

			//this.addPoint(new THREE.Vector3(-100, 0, 0));
			//this.scene.add(pointLight);
			//this.addPointSun(new THREE.Vector3(0, 0, 0), 200, "lensflare2");


			cout("----------------------------------");
			return;

			//cout(ps);

			var skyBoxGeometry = new THREE.BoxGeometry( 5000, 5000, 5000 );
			var texture = new THREE.TextureLoader().load("img/bg2.jpg");
			var skyBoxMaterial = new THREE.MeshBasicMaterial( { map:texture, side: THREE.DoubleSide } );

			var skyBox = new THREE.Mesh( skyBoxGeometry, skyBoxMaterial );

			//this.scene.add(skyBox);


			return;
			/*
			空间坐标
			成都：-230, 50, -150
			鹿特丹：-575, 50， -255
			德黑兰：-437, 50, -175

			*/
			mesh.position.set( 250, 280, 50 );
			mesh.rotation.x = Math.PI/2;

			this.scene.add( mesh );

		},
		
		setCameraPosition: function(x, y, z, lx, ly, lz) {
			this.CAMERA_X = x;
			this.CAMERA_Y = y;
			this.CAMERA_Z = z;
			this.CAMERA_LX = lx;
			this.CAMERA_LY = ly;
			this.CAMERA_LZ = lz;
		},
		//// 核心循环 ////
		animate: function() {
			//// 动画脚本执行
			this.Story.update();
			
			//// 鼠标交互元素
			//var vector = new THREE.Vector3( mouse.x, mouse.y, 1 );
			//vector.unproject( this.camera );
			//var raycaster = new THREE.Raycaster( this.camera.position, vector.sub( this.camera.position ).normalize() );
			//var intersects = raycaster.intersectObjects( this.scene.children );
            //
			//// this.mouseEvent
			//if(intersects.length > 0){
			//	this.mouseEvent.active(intersects[0].object);
			//}else {
			//	this.mouseEvent.unActive();
			//}
            //
			this.move(); 
			this.tellStory();

			this.stats.update();
			this.render();
		},
		
		render: function() {
			// actually render the scene
			this.renderer.render(this.scene, this.camera);
			// this.CAMERA_Y = THREE.Math.clamp( this.camera.position.y + (800 - mouseY - this.camera.position.y ) * .05, 750, 1000 );
			// cout(this.CAMERA_Y);
			return;
			$("#imgTitleCn").html(parseInt(this.camera.position.x) + "," + parseInt(this.camera.position.y) + "," + parseInt(this.camera.position.z)
				//+ "..." + parseInt(this.camera.position.x) + "," + parseInt(this.camera.position.y) + "," + parseInt(this.camera.position.z)
			);
			//cout(this.camera);
			// this.camera.position.y += 1;
			// cout(this.camera.position.y);
		},
		// 一个会反光的球体
		addTestObject: function (pos){
			var matStdParams = {
				roughness: 0.044676705160855, // calculated from shininess = 1000
				metalness: 0.0
			};
			pos = pos || new THREE.Vector3(100, 100, 100);
			var geoSphere = new THREE.SphereGeometry( 10, 32, 32 );
			var matStdObjects = new THREE.MeshStandardMaterial( matStdParams );
			var mshStdSphere = new THREE.Mesh( geoSphere, matStdObjects );
			mshStdSphere.castShadow = true;
			mshStdSphere.receiveShadow = true;
			mshStdSphere.position.copy( pos );
			this.scene.add( mshStdSphere );
			return mshStdSphere;
		},
		addPointEx: function(clr){
			clr = clr || 0xFFFFFF;  //ff0040
			//var sphere = new THREE.SphereGeometry( 0.25, 16, 8 );
			//var light1 = new THREE.PointLight( clr, 2.5, 1000, 2.0 );
			//light1.add( new THREE.Mesh( sphere, new THREE.MeshBasicMaterial( { color: clr } ) ) );
			//this.scene.add( light1 );
			//var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
			//this.scene.add( directionalLight );
			var $this = this;
			var pt1 = new THREE.Vector3(-650, 200, -200),	// 西边
				pt2 = new THREE.Vector3(350, 300, -200),	//美国
				//pt3 = new THREE.Vector3(-230, 300, -175);	//中国
				pt3 = new THREE.Vector3(-150, 200, -300),	//俄罗斯
				pt4 = new THREE.Vector3(500, 200, -350),	//右上角
				pt5 = new THREE.Vector3(-400, 200, -400);	//左上角

			//var obj1 = this.addTestObject();
			//obj1.position.copy(pt3);

			// 环境光
			var ambLight = new THREE.AmbientLight(0xFFFFFF);  //0x2255ee  061756
			this.scene.add(ambLight);

			[pt1, pt2, pt3, pt4, pt5].forEach(function(p){
				var bulbLight = new THREE.PointLight( 0xffffff, 1, 250, 1 );
				bulbLight.position.copy( p );
				bulbLight.castShadow = true;
				//$this.scene.add( bulbLight );
			});

			var sunCitys = [
				{power:100, text:'成都', coord:[104.06, 30.67], size:1 },
				//{power:1000, text:'中心', coord:[134.06, 20.67], size:1 },
				{power:80, text:'北京', coord:[116.23, 39.55], size:0.8 },
				{power:50, text:'香港', coord:[114.08, 22.17], size:0.7 },
				//{power:50, text:'新加坡', coord:[103.45, 1.22], size:0.8 },
				//{power:50, text:'悉尼', coord:[151.17, -33.55], size:0.8 },
				{power:50, text:'法兰克福', coord:[8.34, 50.02], size:0.8 },
				{power:80, text:'巴黎', coord:[2.2, 48.51], size:0.8 },
				{power:80, text:'东京', coord:[139.44, 37.91], size:0.7 },
				{power:300, text:'纽约', coord:[-73.55, 40.44], size:0.8 },
				{power:200, text:'伦敦', coord:[-0.1, 51.5], size:0.8 },
				{power:50, text:'新德里', coord:[77.13, 28.37], size:0.6 }
			];
			sunCitys.forEach(function(d, i){
				var pt = $this.geo.projection(d.coord);
				var center = new THREE.Vector3(pt[0], 50, pt[1]);
				$this.translatePoint(center);

				var centerSun = (d.text=="成都") ?
					new ThreePoint.PointSun(center, d.power, 0x3FCEF6, "_lensflare0.png", 0.5):	//PointGraphSun
					new ThreePoint.PointSun(center, d.power);
				$this.addObjects(centerSun.objects, "sun" + d.text, "sun");
			});

			//return light1;
		},
		addStats:function () {

			var stats = new Stats();

			stats.setMode(0); // 0: fps, 1: ms

			// 放在左上角
			stats.domElement.style.position = 'absolute';
			stats.domElement.style.left = '0px';
			stats.domElement.style.top = '0px';
			document.body.appendChild(stats.domElement);
			this.stats = stats;
			return stats;
		},
		//// 添加城市交互 ////
		addMouseEvent: function(){
			var $this = this;
			return;
			function pause(){
				if($this.Story.initMousePos.x==mouseClient.x && $this.Story.initMousePos.y==mouseClient.y)return;
				$this.Story.stop = true;
			}

			//// 城市信息鼠标交互
			for(var item in this.commonObjects["railCity"]){
				this.mouseEvent.addMouseOver(this.commonObjects["railCity"][item].object, item, function(e){
					e.object.material.opacity = 0.5;
					e.object.scale.z = 5;
					// if() 此处有bug·暂不予处理
					if(e.clientX==0 && e.clientY==0) return;
					//if(e.name=="city布雷斯特") return;
					cout(e.name);

					var cityName = e.name.substr(4), info = $this.cityInfo[[cityName]];
					var city = (info[1]!="China") ? info[2] + " (" + info[3] + ")" : info[2] + " (" + info[3] + ")";
					var country = info[0] + " (" + info[1] + ")";
					var cityImg = info[5], countryImg = info[4];
					//var distance = $this.railCityCache[cityName].clone().sub($this.railCityCache["成都"]).length();
					var pos = [e.clientX, e.clientY];
					var distance = calculateDistance($this.worldCitys['成都'][1], $this.worldCitys['成都'][2],
						$this.worldCitys[cityName][1], $this.worldCitys[cityName][2]
					);
					distance = "距离 成都 " + distance + " Km";

					$this.tooltips.setData([city, country, distance, cityImg, countryImg, pos]);
					pause();
				});
				this.mouseEvent.addMouseOut(this.commonObjects["railCity"][item].object, item, function(e){
					e.object.material.opacity = 1;
					e.object.scale.z = 1;
					$this.tooltips.hide();
					$this.Story.stop = false;
				});
			}

			//// 航班信息鼠标交互
			for(var item in this.commonObjects["plane"]){
				if(item.indexOf("planeOut")==-1)continue;
				this.mouseEvent.addMouseOver(this.commonObjects["plane"][item].object, item, function(e){
					e.object.material.opacity = 0.5;
					var pos = [e.clientX, e.clientY];
					var cityName = e.name.substr(8), info = $this.cityInfo[[cityName]];
					// 航班信息
					if(!info) return;
					var country = info[0] + " (" + info[1] + ")";
					var head = "成都 - " + cityName + ", " + country;
					var content = "时间：" + parseInt(Math.random() * 3 + 1) + " hours " + parseInt(Math.random() * 60) + " minutes<br>"
						+ "其它：共有" + parseInt(Math.random() * 5 + 1) + "次航班飞往 " + country + ".";

					$this.tooltipsTraffic.setData([head, content, "plane2.jpg", pos]);
					pause();
				});
				this.mouseEvent.addMouseOut(this.commonObjects["plane"][item].object, item, function(e){
					e.object.material.opacity = 0.5;
					$this.tooltipsTraffic.hide();
					$this.Story.stop = false;
				});
			}

			//// 铁路信息鼠标交互
			for(var item in this.commonObjects["railWay"]){
				this.mouseEvent.addMouseOver(this.commonObjects["railWay"][item].object, item, function(e){
					var rail = e.name.substr(4);
					var pos = [e.clientX, e.clientY];
					var head = {'South':'南', 'North':'北', 'Center':'中'}[rail];
					var content = {'South': '线路全长 9826 Km, 运行时间提升至 10 天.<br>2016年共开行 460 列.',
						'North':'线路全长 11565 Km, 运行时间提升至 10 天.<br>2016年共开行 460 列.',
						'Center':'线路全长 12826 Km, 运行时间提升至 10 天.<br>2016年共开行 460 列.'
					}[rail];

					$this.tooltipsTraffic.setData(["蓉欧铁路 - "+ head + "段", content, "train1.jpg", pos]);
					$this.NeedUpdateObject["railWay" + e.name].stop = true;
					pause();
				});
				this.mouseEvent.addMouseOut(this.commonObjects["railWay"][item].object, item, function(e){
					$this.NeedUpdateObject["railWay" + e.name].stop = false;
					$this.tooltipsTraffic.hide();
					$this.Story.stop = false;
				});
			}

		}
	};

	function init() {

		$.when(	$.getJSON("data/country_river6.json") ).then(function(data){
			
			worldMap = new Map();
			//worldMap.CAMERA_Y = 100;
			//worldMap.CAMERA_Z = 50;
			
			worldMap.init_d3();
			worldMap.init_tree();

			worldMap.addStats();

			//worldMap.add_light(0, 3000, 0, 1.0, 0xFFFFFF);

			var plain = worldMap.add_plain();
			worldMap.addCitys();

			//worldMap.add_countries(data.country);
			worldMap.add_China(data.country);
			worldMap.add_rivers(data.river);
			worldMap.addPointEx();

			//worldMap.addTestObject();


			// request animation frame
			var onFrame = window.requestAnimationFrame;

			function tick(timestamp) {
				worldMap.animate();
				// (timestamp);

				// if(worldMap.INTERSECTED) {
				// 	$('#country-name').html(worldMap.INTERSECTED.name);
				// } else {
				// 	$('#country-name').html("move mouse over map");
				// }

				// worldMap.CAMERA_Z += 1;
				// plain.rotation.x += 0.01;

				// cout(worldMap.camera.position);
				onFrame(tick);
			}
	
			onFrame(tick);
			
			//document.addEventListener( 'mousemove', onDocumentMouseMove, false );
			window.addEventListener( 'resize', onWindowResize, false );

			worldMap.Story.stop = true;

			window.scene = worldMap.scene;
			window.THREE = THREE;
		});
	}

	function onWindowResize() {

		windowHalfX = window.innerWidth / 2;
		windowHalfY = window.innerHeight / 2;

		worldMap.camera.aspect = window.innerWidth / window.innerHeight;
		worldMap.camera.updateProjectionMatrix();

		worldMap.renderer.setSize( window.innerWidth, window.innerHeight );
	}

	/*
	function onDocumentMouseMove( event ) {
		event.preventDefault();
		//// 屏幕坐标到世界坐标系？

		mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
		mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

		mouseClient.x = event.clientX;
		mouseClient.y = event.clientY;

		//mouseY = event.clientY;
		// cout([mouse.x, mouse.y, event.clientX, event.clientY]);
	}

	$('.navbar-fixed-top ul li a').click(function() {
		switch (this.hash) {

		   case "#railWay":
			  worldMap.setCameraPosition(100, 320, 200, 100, 50);
			  break;
		   case "#plane":
			  worldMap.setCameraPosition(75, 210, -75, 75, -150);

			  break;
		   case "#lutedan":
			  //worldMap.setCameraPosition(-575, 250, -255, -575, -280);	//350
     	   	 	worldMap.setCameraPosition(-575, 250, -255, -575, -280);	//350
			  break;
		   case "#chengdu":
			   worldMap.Story.stop = false;
			   //
			   //worldMap.NeedUpdateObject["growLine" + "railCenter"].stop = false;
			   //worldMap.NeedUpdateObject["growLine" + "railNorth"].stop = false;
			   // worldMap.NeedUpdateObject["growLine" + "railSouth"].stop = false;
			  //worldMap.setCameraPosition(-230, 260, -175, -230, -220);
			  break;
		   case "#deheilan":
		   	  worldMap.setCameraPosition(-437, 350, -175, -437, -200);
			  break;
		   case "#australia":
			  worldMap.setCameraPosition(500, 270, 300, 500, 120);
			  break;
		   case "#all":
			  worldMap.setCameraPosition(0, 800, 400, 0, 0);
			  break;
		}
	});
	*/

	window.onload = init;
		
}());