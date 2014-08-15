var stats = new Stats();
stats.setMode(0); // 0: fps, 1: ms
stats.domElement.style.position = 'absolute';
stats.domElement.style.left = '0px';
stats.domElement.style.top = '0px';
document.body.appendChild( stats.domElement );

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sign#Polyfill
if(!Math.sign) {
	Math.__proto__.sign = function(x) {
		if(isNaN(x)) {
			return NaN;
		} else if(x === 0) {
			return x;
		} else {
			return (x > 0 ? 1 : -1);
		}
	}
}

function V2D(x, y) {
	this.x = x || 0;
	this.y = y || 0;
}

V2D.prototype.mag = function() {
	return Math.sqrt(this.x * this.x + this.y * this.y);
};

V2D.prototype.normalize = function() {
	var length = this.mag();
	if(length > 0) {
		x /= length;
		y /= length;
	}
}

V2D.prototype.mult = function(value) {
	var v = Math.sign(value) * Math.sqrt(Math.abs(value));
	x *= v;
	y *= v;
}

function RK41DObject_State(u, s) {
	this.u = u;
	this.s = s;
}

function RK41DObject_Derivative(du, ds) {
	this.du = du;
	this.ds = ds;
}

function RK41DObject() {
	this.state = new RK41DObject_State(0, 0);
}

RK41DObject.prototype.evaluate = function(initialState, t, dt, derivative) {
	if(typeof dt == 'undefined') {
		return new RK41DObject_Derivative(initialState.s, this.acceleration(initialState, t));
	} else {
		var state = new RK41DObject_State(initialState.u + derivative.du * dt,
							  initialState.s + derivative.ds * dt);

		return new RK41DObject_Derivative(state.s, this.acceleration(state, t + dt));
	}
};

RK41DObject.prototype.integrate = function(t, dt) {
	var a = this.evaluate(this.state, t),
	    b = this.evaluate(this.state, t, dt * 0.5, a),
	    c = this.evaluate(this.state, t, dt * 0.5, b),
	    d = this.evaluate(this.state, t, dt, c);

	var dxdt = 1/6 * (a.du + 2 * (b.du + c.du) + d.du),
	    dvdt = 1/6 * (a.ds + 2 * (b.ds + c.ds) + d.ds);

	this.state.u = this.state.u + dxdt * dt;
	this.state.s = this.state.s + dvdt * dt;
};

// TODO Improve this
function normalizeRadian(a) {
	while(a > 2 * Math.PI) {
		a -= 2 * Math.PI;
	}

	while(a < 0) {
		a += 2 * Math.PI;
	}

	return a;
}


(function() {
	var canvas = document.getElementById('c'),
		ctx = canvas.getContext('2d'),
		container = canvas.parentNode;

	var SCALE, GAME_WIDTH, GAME_HEIGHT, V_OFFSET, H_OFFSET,
		BOTTOM_BORDER, TOP_BORDER, LEFT_BORDER, RIGHT_BORDER,
		CANNON_BASE_WIDTH, CANNON_BASE_HEIGHT, CANNON_LENGTH, CANNON_WIDTH;

	const PAUSED = 1, RUNNING = 2, GAMEOVER = 3;

	// Browsers supporting high resolution timestamps will use them in requestAnimationFrame
	var lastFrameTime = performance.now ? performance.now() : Date.now();
	var staticBalls = [];
	var currentBall = null;

	function Cannon() {
		RK41DObject.call(this);
		this.state.u = 0;
		this.state.s = Math.PI / 3;
	}

	Cannon.prototype = new RK41DObject();
	Cannon.prototype.constructor = RK41DObject;

	Cannon.prototype.acceleration = function(state, t) {
		return 0;
	};

	Cannon.prototype.getAngle = function() {
		return this.state.u + Math.PI / 2;
	};

	Cannon.prototype.update = function(t, dt) {
		this.integrate(t, dt);

		if(Math.abs(this.state.u) >= Math.PI / 2) {
			this.state.u = ((Math.PI / 2) - Math.abs(Math.PI / 2 - Math.abs(this.state.u))) * Math.sign(this.state.u);
			this.state.s *= -1;
		}
	};

	Cannon.prototype.draw = function(ctx) {
		var r = Math.round(CANNON_BASE_WIDTH / 2);

		ctx.fillStyle = 'white';
		ctx.beginPath();
		ctx.moveTo(Math.round(H_OFFSET + SCALE / 2) - r,
		           Math.round(BOTTOM_BORDER + SCALE / 6));
		ctx.lineTo(Math.round(H_OFFSET + SCALE / 2) - r,
		           Math.round(BOTTOM_BORDER + SCALE / 6 - CANNON_BASE_HEIGHT));
		ctx.arc(
				Math.round(H_OFFSET + SCALE / 2),
				Math.round(BOTTOM_BORDER + SCALE / 6 - CANNON_BASE_HEIGHT),
				r,
				Math.PI,
				0
			);
		ctx.lineTo(Math.round(H_OFFSET + SCALE / 2) + r,
		           Math.round(BOTTOM_BORDER + SCALE / 6));
		ctx.closePath();
		ctx.fill();

		ctx.lineWidth = CANNON_WIDTH;
		ctx.lineCap = 'butt';
		ctx.beginPath();
		ctx.moveTo(H_OFFSET + SCALE / 2,
				   BOTTOM_BORDER + SCALE / 6 - CANNON_BASE_HEIGHT);
		ctx.lineTo(H_OFFSET + SCALE / 2 + Math.cos(this.getAngle()) * CANNON_LENGTH,
				   BOTTOM_BORDER + SCALE / 6 - CANNON_BASE_HEIGHT - Math.sin(this.getAngle()) * CANNON_LENGTH);
		ctx.stroke();
		ctx.closePath();
	};

	function Ball(r, x, y, a) {
		RK41DObject.call(this);
		this.nr = r; // Normalized radius and coordinates
		this.nx = x;
		this.ny = y;

		this.direction = a;
		this.state.u = 0;
		this.state.s = 1;

		this.counter = 3;
	}

	Ball.prototype = new RK41DObject();
	Ball.prototype.constructor = RK41DObject;

	Ball.prototype.draw = function(ctx) {
		var x = LEFT_BORDER + this.nx * SCALE,
		    y = BOTTOM_BORDER - this.ny * SCALE,
		    r = this.nr * SCALE;

		ctx.fillStyle = 'white';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI*2, false);

		if(this.counter == 1) {
			ctx.moveTo(Math.round(x - r * 0.2), Math.round(y - r * 0.7));
			ctx.lineTo(Math.round(x - r * 0.2), Math.round(y + r * 0.7));
			ctx.lineTo(Math.round(x + r * 0.2), Math.round(y + r * 0.7));
			ctx.lineTo(Math.round(x + r * 0.2), Math.round(y - r * 0.7));
		} else if(this.counter == 2) {
			ctx.moveTo(Math.round(x - r * 0.5), Math.round(y - r * 0.7));
			ctx.lineTo(Math.round(x - r * 0.5), Math.round(y - r * 0.3));
			ctx.lineTo(Math.round(x + r * 0.1), Math.round(y - r * 0.3));
			ctx.lineTo(Math.round(x + r * 0.1), Math.round(y - r * 0.15));
			ctx.lineTo(Math.round(x - r * 0.5), Math.round(y - r * 0.15));
			ctx.lineTo(Math.round(x - r * 0.5), Math.round(y + r * 0.7));
			ctx.lineTo(Math.round(x + r * 0.5), Math.round(y + r * 0.7));
			ctx.lineTo(Math.round(x + r * 0.5), Math.round(y + r * 0.3));
			ctx.lineTo(Math.round(x - r * 0.1), Math.round(y + r * 0.3));
			ctx.lineTo(Math.round(x - r * 0.1), Math.round(y + r * 0.15));
			ctx.lineTo(Math.round(x + r * 0.5), Math.round(y + r * 0.15));
			ctx.lineTo(Math.round(x + r * 0.5), Math.round(y - r * 0.7));
		} else if(this.counter == 3) {
			ctx.moveTo(Math.round(x - r * 0.5), Math.round(y - r * 0.7));
			ctx.lineTo(Math.round(x - r * 0.5), Math.round(y - r * 0.3));
			ctx.lineTo(Math.round(x + r * 0.1), Math.round(y - r * 0.3));
			ctx.lineTo(Math.round(x + r * 0.1), Math.round(y - r * 0.15));
			ctx.lineTo(Math.round(x - r * 0.5), Math.round(y - r * 0.15));
			ctx.lineTo(Math.round(x - r * 0.5), Math.round(y + r * 0.15));
			ctx.lineTo(Math.round(x + r * 0.1), Math.round(y + r * 0.15));
			ctx.lineTo(Math.round(x + r * 0.1), Math.round(y + r * 0.3));
			ctx.lineTo(Math.round(x - r * 0.5), Math.round(y + r * 0.3));
			ctx.lineTo(Math.round(x - r * 0.5), Math.round(y + r * 0.7));
			ctx.lineTo(Math.round(x + r * 0.5), Math.round(y + r * 0.7));
			ctx.lineTo(Math.round(x + r * 0.5), Math.round(y - r * 0.7));
		}
		ctx.closePath();
		ctx.fill();
	};

	Ball.prototype.acceleration = function(state, t) {
		return -0.4;
	};

	Ball.prototype.update = function(t, dt) {
		var previousState = new RK41DObject_State(this.state.u, this.state.v);

		this.integrate(t, dt);

		var d = this.state.u - previousState.u;
		this.nx += d * Math.cos(this.direction);
		this.ny += d * Math.sin(this.direction);

		this.bounce();
	};

	Ball.prototype.bounce = function() {
		if (this.nx > 1 - this.nr) {
			this.nx = 1 - this.nr;
			this.direction = normalizeRadian(Math.PI - this.direction);
		} else if (this.nx < this.nr) {
			this.nx = this.nr;
			this.direction = normalizeRadian(Math.PI - this.direction);
		} 

		if (this.ny > 1 - this.nr) {
			this.ny = 1 - this.nr;
			this.direction = normalizeRadian(-this.direction);
		}

		for(var i = staticBalls.length - 1; i >= 0; --i) {
			var o = staticBalls[i];

			var normal = new V2D(this.nx - o.nx, this.ny - o.ny);
			if(normal.mag() <= o.nr + this.nr) {
				--o.counter;

				var  alpha = Math.atan2(normal.y, normal.x),
				      sine = Math.sin(alpha),
				    cosine = Math.cos(alpha);

				var velocity = new V2D(Math.cos(this.direction), Math.sin(this.direction));

				var bTemp = new V2D(
					cosine * normal.x + sine * normal.y,
					cosine * normal.y - sine * normal.x
					);

				var vTemp = new V2D(
					cosine * velocity.x + sine * velocity.y,
					cosine * velocity.y - sine * velocity.x
					);

				var vFinal = new V2D(-vTemp.x, vTemp.y);

				bTemp.x += vFinal.x / SCALE;

				var bFinal = new V2D();
				bFinal.x = cosine * bTemp.x - sine * bTemp.y;
				bFinal.y = cosine * bTemp.y + sine * bTemp.x;


				this.nx = o.nx + bFinal.x;
				this.ny = o.ny + bFinal.y;

				velocity.x = cosine * vFinal.x - sine * vFinal.y;
				velocity.y = cosine * vFinal.y + sine * vFinal.x;

				this.direction = Math.atan2(velocity.y, velocity.x);

				if(o.counter == 0) {
					++score;
					staticBalls.splice(i, 1);
				}
			}
		}
	};

	Ball.prototype.grow = function() {
		var minRadius = Number.MAX_VALUE,
		    available,
			o,
			vector;

		for(var i = 0; i < staticBalls.length; ++i) {
			o = staticBalls[i];
			vector = new V2D(this.nx - o.nx, this.ny - o.ny);
			available = vector.mag() - o.nr;
			if(minRadius > available) minRadius = available;
		}

		available = this.nx;
		if(minRadius > available) minRadius = available;

		available = 1 - this.nx;
		if(minRadius > available) minRadius = available;

		available = Math.abs(this.ny);
		if(minRadius > available) minRadius = available;

		available = Math.abs(1 - this.ny);
		if(minRadius > available) minRadius = available;

		this.nr = Math.abs(minRadius);
	};

	var cannon = new Cannon();
	var lastClickDate = 0;
	var gameState = RUNNING;
	var score = 0;
	var highscore;

	initialize();

	function initialize() {
		highscore = localStorage.getItem('highscore');
		highscore = (highscore == null) ? 0 : parseInt(highscore, 10);

		window.addEventListener('resize', resizeCanvas, false);
		resizeCanvas();
		canvas.addEventListener('mousedown', handleClick, false);
		canvas.addEventListener('touchstart', handleClick, false);

		document.addEventListener('visibilitychange', handleVisibilityChange, false);

		window.requestAnimationFrame(step);
	}

	function handleClick(evt) {
		if(Date.now() - lastClickDate < 1000)
			return;

		lastClickDate = Date.now();

		if(gameState == GAMEOVER) {
			currentBall = null;
			staticBalls = [];
			gameState = RUNNING;
			score = 0;
			window.requestAnimationFrame(step);
			return false;
		}

		var rect = canvas.getBoundingClientRect();
		var x = evt.clientX - rect.left,
		    y = evt.clientY - rect.top

		if((x > canvas.width - 60) && (y < 60)) {
			if(gameState == RUNNING ) {
				gameState = PAUSED;
			} else if(gameState == PAUSED) {
				gameState = RUNNING;
				lastFrameTime = performance.now ? performance.now() : Date.now();
				window.requestAnimationFrame(step);
			}

			return false;
		}

		if((currentBall == null) && (gameState == RUNNING)) {
			currentBall = new Ball(
				1 / 40,
				0.5 + Math.cos(cannon.getAngle()) * CANNON_LENGTH / SCALE,
				-1 / 6 + CANNON_BASE_HEIGHT / SCALE + Math.sin(cannon.getAngle()) * CANNON_LENGTH / SCALE,
				cannon.getAngle());
			return false;
		}

		return false;
	}

	function handleVisibilityChange() {
		if (document.hidden) {
			gameState = PAUSED;
		}
	}

	function step(time) {
		stats.begin();

		if(gameState == RUNNING)
			update(time);

		draw();

		stats.end();

		window.requestAnimationFrame(step);
	}

	function update(time) {
		if(currentBall) {
			var last = lastFrameTime, current;
			for(var i = 1; i <= 10; ++i) {
				current = (lastFrameTime* (10-i) + time * i) / 10;
				currentBall.update(last / 1000, (current - last) / 1000);
				if(currentBall.ny < currentBall.nr && normalizeRadian(currentBall.direction) > Math.PI) {
					currentBall.state.s = 0;
					if(score > highscore) {
						highscore = score;
						localStorage.setItem('highscore', (score).toString(10));
					}
					gameState = GAMEOVER;
				}
				if(currentBall.state.s < 0.01) {
					if(currentBall.ny >= 0) {
						currentBall.grow();
						staticBalls.push(currentBall);
					}
					currentBall = null;
					break;
				}
				last = current;
			}
		}

		cannon.update(lastFrameTime / 1000, (time - lastFrameTime) / 1000);

		lastFrameTime = time;
	}

	function draw() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		if(gameState == GAMEOVER) {
			ctx.textAlign = 'center';
			ctx.fillStyle = 'white';
			ctx.font = Math.floor(SCALE / 12) + 'pt Arial';
			ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);

			return;
		}

		// Always add 0.5 to coordinates of lines of width 1
		// https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Canvas_tutorial/Applying_styles_and_colors#A_lineWidth_example
		ctx.strokeStyle = 'white';
		ctx.lineWidth = '1';
		ctx.beginPath();
		ctx.moveTo(Math.floor(LEFT_BORDER) + 0.5, Math.floor(TOP_BORDER) + 0.5);
		ctx.lineTo(Math.floor(RIGHT_BORDER) - 0.5, Math.floor(TOP_BORDER) + 0.5);
		ctx.lineTo(Math.floor(RIGHT_BORDER) - 0.5, Math.floor(BOTTOM_BORDER) + 0.5);
		ctx.lineTo(Math.floor(LEFT_BORDER) + 0.5, Math.floor(BOTTOM_BORDER) + 0.5);
		ctx.closePath();
		ctx.stroke();

		cannon.draw(ctx);

		for(var i = 0; i < staticBalls.length; ++i)
			staticBalls[i].draw(ctx);

		if(currentBall)
			currentBall.draw(ctx);

		ctx.fillStyle = 'white';
		if(gameState == RUNNING) {
			ctx.fillRect(canvas.width - 40, 10, 10, 40);
			ctx.fillRect(canvas.width - 20, 10, 10, 40);
		} else if(gameState == PAUSED) {
			ctx.beginPath();
			ctx.moveTo(canvas.width - 40, 10);
			ctx.lineTo(canvas.width - 40, 40);
			ctx.lineTo(canvas.width - 10, 25);
			ctx.closePath();
			ctx.fill();
		}

		ctx.font = Math.floor(SCALE / 12) + 'pt Arial';
		ctx.textAlign = 'left';
		ctx.fillText('Highscore', LEFT_BORDER, V_OFFSET + Math.floor(SCALE / 12));
		ctx.fillText('Score', LEFT_BORDER, V_OFFSET + 2 * Math.floor(SCALE / 12));
		var scoreOffset = ctx.measureText("Highscore ").width;
		ctx.fillText(highscore, LEFT_BORDER + scoreOffset, V_OFFSET + Math.floor(SCALE / 12));
		ctx.fillText(score, LEFT_BORDER + scoreOffset, V_OFFSET + 2 * Math.floor(SCALE / 12));
	}

	function resizeCanvas() {
		canvas.width = container.clientWidth;
		canvas.height = container.clientHeight;

		computeGameDimensions();

		window.requestAnimationFrame(step);
	}

	function computeGameDimensions() {
		var w = canvas.width, h = canvas.height;

		if(w / h < 3/4) {
			GAME_WIDTH = w;
			GAME_HEIGHT = 4/3 * GAME_WIDTH;
		} else {
			GAME_HEIGHT = h;
			GAME_WIDTH = 3/4 * GAME_HEIGHT;
		}

		SCALE              = GAME_WIDTH;
		V_OFFSET           = (h - GAME_HEIGHT) / 2;
		H_OFFSET           = (w - GAME_WIDTH) / 2;
		TOP_BORDER         = V_OFFSET + SCALE / 6;
		BOTTOM_BORDER      = TOP_BORDER + SCALE;
		LEFT_BORDER        = H_OFFSET;
		RIGHT_BORDER       = LEFT_BORDER + SCALE;
		CANNON_BASE_WIDTH  = SCALE / 10;
		CANNON_BASE_HEIGHT = SCALE / 15;
		CANNON_LENGTH      = SCALE / 15;
		CANNON_WIDTH       = SCALE / 18;

	}
})();

