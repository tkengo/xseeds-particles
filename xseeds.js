var scene     = new THREE.Scene();
var camera    = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
var renderer  = new THREE.WebGLRenderer({ antialias: true, alpha: true });
var particles = new THREE.Object3D();
var lensFlare;
var dustClound;
var background;
var pointLight;
var logo;
var particleMaterials = [];
var flareBurstTexture = THREE.ImageUtils.loadTexture('images/flare.jpg');

var FONT_FAMILY = 'Open Sans';
var WIDTH = 160;
var HEIGHT = 40;
var SCALE = 3;
var DURATION = 7.0;
var INITIAL_DELAY = 5;
var DELAY = INITIAL_DELAY + 4.0;

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
camera.position.z = 150;
camera.lookAt(new THREE.Vector3(0, 0, 0));

window.onload = function() {
  document.body.appendChild(renderer.domElement);
  initializeScene();
  loadFont(function() {
    startMovie();
    (function() {
      requestAnimationFrame(arguments.callee);
      if (dustClound) {
        dustClound.position.x += 0.01;
        dustClound.position.y += 0.01;
      }
      renderer.render(scene, camera);
    })();
  });
};

/**
 * xseedsという文字を書くためのウェブフォントを読み込む。非同期で読み
 * 込まれるので読み込み完了を検知してから実際のWebGL処理を開始する。
 * 検知の手法としては、適当なテキストをspan要素に差し込んで、一定間隔
 * でテキストの横幅を計算する。もしテキストの横幅が変わっていればフォ
 * ントが読み込まれたとみなして先の処理に進む。
 */
function loadFont(callback) {
  var tester = document.createElement("span");
  tester.style.fontFamily = "'" + FONT_FAMILY + "', 'monospace'";
  tester.innerHTML = 'QW@HhsXJ';
  document.body.appendChild(tester);

  var beforeWidth = tester.offsetWidth;
  var count = 0;

  // フォントの読み込みが完了するまで繰り返しテキストの幅を測り続ける。
  // ただし、端末内に既にフォントが存在する場合は幅が変わらないので、
  // 最大で20回施行しても幅が変わらなければ
  // 1. 既にフォントが入っている
  // 2. 本当にフォントのロードに失敗してる
  // となる。このどちらの場合もダメであれば諦める。
  (function() {
    if (count > 20 || (count > 10 && tester.offsetWidth !== beforeWidth)) {
      document.body.removeChild(tester);
      callback();
    } else {
      count++;
      setTimeout(arguments.callee, 100);
    }
  })();
}

function initializeScene() {
  scene.fog = new THREE.FogExp2('#140066', 0.035);

  pointLight = new THREE.PointLight('#4488ff', 50, 500);
  pointLight.position.set(0, 0, 300);

  // 背景オブジェクト。画面いっぱいのプレーンポリゴンを作ってそこに背
  // 景用の画像をテクスチャとして貼り付ける。背景が単調にならないよう
  // にグラデーションを使って少しゆらぎをつけている。
  var backgroundGeometry = new THREE.PlaneBufferGeometry(
    window.innerWidth,
    window.innerHeight
  );
  var backgroundMaterial = new THREE.MeshBasicMaterial({
    map: THREE.ImageUtils.loadTexture('images/bg.jpg'),
    color: '#000000',
    fog: false
  });
  background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
  background.position.z = -50;

  // 空間に舞うチリやホコリのような演出を作り上げるために大量のパーテ
  // ィクルをランダムに配置。画面表示時には隠しておいて、数秒経過後に
  // ふわっと表示させたいので初期状態で透明にしておく。
  var cloudGeometry = new THREE.Geometry();
  for (var i = 0; i < 5000; i++) {
    cloudGeometry.vertices.push(new THREE.Vector3(
      300 * (Math.random() - 0.5),
      300 * (Math.random() - 0.5),
      100 * (Math.random() / 2) + 100
    ));
  }
  var cloundMaterial = new THREE.PointCloudMaterial({
    map: THREE.ImageUtils.loadTexture('images/p.png'),
    size: 4,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    fog: true
  });
  dustClound = new THREE.PointCloud(cloudGeometry, cloundMaterial);

  // XSEEDSのロゴ。テキストの表示が全部完了してからロゴを表示するので
  // 初めは非表示にしておく。
  var logoGeometry = new THREE.PlaneBufferGeometry(130, 130, 1, 1);
  var logoMaterial = new THREE.MeshBasicMaterial({
    map: THREE.ImageUtils.loadTexture('images/icon.png'),
    blending: THREE.AdditiveBlending,
    transparent: true,
    visible: false,
    fog: false
  });
  logo = new THREE.Mesh(logoGeometry, logoMaterial);
  logo.position.set(0, 70, 10);

  // 文字表示用のパーティクルに使うマテリアルを準備。20個準備しておい
  // てその中からランダムで選んで使う。
  for (var i = 0; i < 20; i++) {
    var texture = new THREE.Texture(createCircleCanvas());
    texture.needsUpdate = true;
    var material = new THREE.MeshPhongMaterial({
      map: texture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      fog: false
    });
    particleMaterials.push(material);
  }

  // キャンバスにxseedsという文字を書いた後に、その画像データを取得して
  // 文字が書かれているピクセル(=透明ではないピクセル)を抽出。それをパ
  // ーティクルとして生成。
  var context = createText('xseeds');
  var data = context.getImageData(0, 0, WIDTH, HEIGHT).data;
  for (var i = 0; i < WIDTH; i++) {
    for (var j = 0; j < HEIGHT; j++) {
      if (data[(i + j * WIDTH) * 4 + 3] == 0) {
        continue;
      }

      var geometry = new THREE.PlaneBufferGeometry(SCALE, SCALE);
      var material = particleMaterials[Math.floor(particleMaterials.length * Math.random())];
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(30, -25, 140);
      mesh.userData.lastPosition = {
        x: (i - WIDTH / 2) * (SCALE + 1),
        y: (HEIGHT - j - HEIGHT / 2 - 4) * (SCALE + 1)
      };
      particles.add(mesh);
    }
  }

  scene.add(pointLight);
  scene.add(background);
  scene.add(dustClound);
  scene.add(logo);
  scene.add(particles);
}

function startMovie() {
  var t = new TimelineMax();
  var t0 = new TimelineMax();
  t0.to(background.material.color, 2.0, {
    onUpdate: function() {
      var hsl = background.material.color.getHSL();
      background.material.color.setHSL(0.7, 1.0, this.progress() / 2);
    }
  }, 1)
  .to(dustClound.material, 2.0, {
    opacity: 0.2
  }, 1);

  return;
  for (var i = 0; i < particles.children.length; i++) {
    var mesh     = particles.children[i];
    var position = mesh.userData.lastPosition;
    var delay    = INITIAL_DELAY + 1.5 * Math.random();

    var curvePoint = [{
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z
    }, {
      x:   0 + (20 * (Math.random() - 0.5)),
      y: 100 + (20 * (Math.random() - 0.5)),
      z: mesh.position.z / 10
    }, {
      x: -120 + (100 * (Math.random() - 0.5)),
      y:  -60 + (100 * (Math.random() - 0.5)),
      z: 0
    }, {
      x: position.x / 10 + 400,
      y: position.y / 10 + 400,
      z: camera.position.z + 200
    }];

    t.to (mesh.position, DURATION, { bezier: curvePoint, ease: Expo.easeNone }, delay)
     .set(mesh.position, { x: position.x, y: position.y }, DELAY)
     .to (mesh.position, 0.2, { z: 10, ease: Expo.easeOut }, DELAY + 0.3 + Math.random() * 0.3);
  }

  t.call(endMovie, [], this, DELAY)
   .to(logo.rotation, 1.0, { y: 2 * Math.PI }, DELAY);

  var tt = new TimelineMax();
  for (var i = 0; i < particleMaterials.length; i++) {
    tt.to(particleMaterials[i], 0.8, {
      opacity: 0.2 * Math.random() + 0.4,
      startAt: { opacity: 1 },
      repeat: -1,
      yoyo: true,
      onUpdate: function(material, hsl) {
        material.color.setHSL(hsl.h + (this.progress() / 5), hsl.s, hsl.l);
      },
      onUpdateParams: [ particleMaterials[i], particleMaterials[i].color.getHSL() ]
    }, DELAY + Math.random());
  }
}

function endMovie() {
  pointLight.position.z = 20;
  logo.material.visible = true;
  setTimeout(function() {
    var lensFlare = new THREE.LensFlare(
      flareBurstTexture,
      700,
      0,
      THREE.AdditiveBlending,
      new THREE.Color(0xffffff)
    );
    lensFlare.position.set(13, 74, 20);
    // scene.add(lensFlare);
  }, 100);
}

function createText(text) {
  var canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  var context = canvas.getContext("2d");
  context.font = '30px "' + FONT_FAMILY + '"';
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.fillText(text, WIDTH / 2, 30);
  return context;
}

function createCircleCanvas() {
  var canvas = document.createElement('canvas');
  var SIZE = 128;
  var HALF = SIZE / 2;
  var CENTER = SIZE / 2;
  canvas.width = SIZE;
  canvas.height = SIZE;
  var context = canvas.getContext('2d');
  context.lineWidth = 0;
  context.beginPath();
  context.arc(CENTER, CENTER, HALF, 0, 2 * Math.PI, false);
  var grad = context.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, HALF);
  var color = new THREE.Color();
  var h = 200 + 30 * Math.random();
  var s = 40 + Math.random() * 20;
  var l = 50 + Math.random() * 20;
  color.setHSL(h / 360, s / 100, l / 100);
  grad.addColorStop(0, color.getStyle());
  grad.addColorStop(1, '#000000');
  context.fillStyle = grad;
  context.fill();
  context.closePath();
  return canvas;
}
