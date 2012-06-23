/*!
 * PhotoTopo @VERSION - A javascript climbing route editing widget
 *
 * Copyright (c) 2010-2011 Brendan Heywood
 *
 * http://github.com/brendanheywood/PhotoTopo/
 *
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */
"use strict";

/**
 * @private
 * stores the collection of points that are in the same location
 * @constructor 
 * @param {Point} point The first point in this group
 */
function PointGroup(point){
	this.points = [];
	this.points[0] = point;
	
	// these coords may get changed imediately after creation
	this.x = point.x;
	this.y = point.y;
}

/**
 * add another point to an existing pointGroup
 * @param {Point} point the point to add
 */
PointGroup.prototype.add = function(point){
	var c;

	this.points[this.points.length] = point;
	this.sort();
	if (this.points[0].route.phototopo.loading){ 
		return;
	}
	for (c=0; c < this.points.length; c++){
		this.points[c].updateLabelPosition();
	} 
};
PointGroup.prototype.sort = function(){
	this.points.sort(function(a,b){
		return a.route.order > b.route.order ? 1 : -1;
	});

};


/**
 * gets the points order in this group
 * points have a natural order which is typically the order the routes are shown in the guide (eg left to right)
 */
PointGroup.prototype.getLabelPosition = function(point){
	var c,
		pos = 0;

	for(c=0; c < this.points.length; c++){
		// only count points that have a visible label
		if(this.points[c].labelEl){ pos++; }
		if (this.points[c] === point){
			return c;
		}
	}
};

/*
 * return the amount the curve should be offset when multiple curves overlap
 */
PointGroup.prototype.getSplitOffset = function(point){
	var c, ret;

	for(c=0; c < this.points.length; c++){
		if (this.points[c] === point){
			ret = (1 - this.points.length) / 2 + c;
			return ret;
		}
	}
	return 0;
};


/*
 * the point has moved so redraw all connected paths
 */
PointGroup.prototype.redraw = function(point){
	var c,p;
	for(c=0; c < this.points.length; c++){
		p = this.points[c];
		if (p.nextPath){
			p.nextPath.redraw();
		}
		if (p.prevPath){
			p.prevPath.redraw();
		}
	}
};

/*
 * 
 */
PointGroup.prototype.remove = function(point){
	var c, pt;
	for(c=this.points.length-1; c>=0; c--){
		if (this.points[c] === point){
			this.points.splice(c,1);
		}
	}
	if (this.points.length === 0){
		pt = point.route.phototopo;
		delete pt.pointGroups[pt.getKey(point)];
	}
	for (c=0; c<this.points.length; c++){
		this.points[c].updateLabelPosition();
	}
};



/*
 * returns the x/y coords of the cubic bezier curve that should come out of this point
 * just make them negative to get the handle for the opposite end of the cubic curve
 * a simplistic algortith just averages them all, a more complex one takes into account which routes actually merge or don't
 */
PointGroup.prototype.getAngle = function(point){

	// for each point get the diff of it and the next point and the previous point and add them all together
	// then find that angle and scale the point to the shortest path segment length
	
	var dx = 0,
		dy = 0,
		ddx = 0,
		ddy = 0,
		p,c,
		sqr,
		minSqr = 1000000,
		angle,
		dist;
	
	for(c=0; c < this.points.length; c++){
		p = this.points[c];
		if (p.nextPoint){
			dx = (p.nextPoint.x - p.x);
			dy = (p.nextPoint.y - p.y);
			sqr = dx*dx + dy*dy;
			if (sqr < minSqr){ minSqr = sqr; }
			ddx += dx;
			ddy += dy;
		}
		if (p.prevPoint){
			dx = (p.prevPoint.x - p.x);
			dy = (p.prevPoint.y - p.y);
			sqr = dx*dx + dy*dy;
			if (sqr < minSqr){ minSqr = sqr; }
			ddx -= dx;
			ddy -= dy;
		}
	}
	
	angle = Math.atan2(ddx, ddy);
	dist = Math.sqrt(minSqr) * 0.4;
	
	ddx = dist * Math.sin(angle);
	ddy = dist * Math.cos(angle);
		
	return {dx:ddx,dy:ddy};
};




/**
 * @private
 * there is one point for every point on a route - two points can occupy the same location
 * @constructor 
 * @param {Route} 
 * @param {Integer} x x cordinate
 * @param {Integer} y y coordinate
 * @param {Integer} position where along the route it is added
 */
function Point(route, x, y, type, position){

	var styles,
		circle,
		point = this;
	this.route = route;
	this.x = x*1;
	this.y = y*1;
	if (!type){type = 'none';}
	this.type = type;
	this.position = position;
	
	this.labelEl = null;
	this.iconEl = null;
	
	
	this.nextPoint = null;
	this.prevPoint = null;
	this.nextPath = null;
	this.prevPath = null;
	
	this.pointGroup = this.route.phototopo.getPointGroup(this);
	
	
	styles = this.route.phototopo.styles;


	function dragStart(){
		var selectedRoute = this.point.route.phototopo.selectedRoute;
		$(this.point.route.phototopo.photoEl).addClass('dragging');

		this.ox = this.attr("cx");
		this.oy = this.attr("cy");
			
		// don't allow draging of points if another route is selected
		if (selectedRoute && selectedRoute !== this.point.route){
			return;
		}
		circle.animate(styles.handleHover, 100);
		this.point.select();
	}

	function dragMove(dx, dy){
		var selectedRoute = this.point.route.phototopo.selectedRoute, pos;
		if (selectedRoute && selectedRoute !== this.point.route){
			return;
		}
		pos = circle.point.moveTo(this.ox + dx, this.oy + dy);
		circle.attr({cx: pos.x, cy: pos.y});
	}

	function dragEnd(){
		var selectedRoute = this.point.route.phototopo.selectedRoute;
		$(this.point.route.phototopo.photoEl).removeClass('dragging');

		if (selectedRoute && selectedRoute !== this.point.route){
			return;
		}
		this.point.setStyle();
	}

	if (this.route.phototopo.options.editable){


		this.circle = this.route.phototopo.canvas.circle(this.x, this.y, 5);
		circle = this.circle;
		circle.point = this;
		circle.attr(styles.handle);
		if (this.route.autoColor){
			circle.attr('fill', this.route.autoColor);
			circle.attr('stroke', this.route.autoColorBorder);
		}
		
		circle.drag(dragMove, dragStart, dragEnd); 
		circle.mouseover(function(){
			// is it the last point of a routes?
			if (this.point.nextPoint){
				$('#phototopoContextMenu .hidden').removeClass('disabled');
				$('#phototopoContextMenu .jumpoff').addClass('disabled');
			} else {
				$('#phototopoContextMenu .hidden').addClass('disabled');
				$('#phototopoContextMenu .jumpoff').removeClass('disabled');
			}

			$(this.point.route.phototopo.photoEl).addClass('point');

			//this.point.setStyle();
			this.point.route.onmouseover(this.point);
			this.animate(styles.handleHover, 100);
		});
		circle.mouseout(function(){
			$(this.point.route.phototopo.photoEl).removeClass('point');
			this.point.route.onmouseout(this.point);
			this.point.setStyle();
		});
		circle.click(function(e){
			var route = this.point.route.phototopo.selectedRoute;
			// don't allow adding a point in the current route back to itself
			if (this.point.route === route){
				return;
			}
			if (route){
				route.addAfter(this.point.route.phototopo.selectedPoint, this.point.x, this.point.y);
			} else {
				this.point.select();
			}
		});
		circle.dblclick(function(){
			this.point.remove();
		});
	
	
		$(circle.node).contextMenu({
			menu: 'phototopoContextMenu'
		},
			function(action, el, pos) {
				point.setType(action);
				point.pointGroup.redraw();
				point.route.phototopo.saveData();

		});
		
		
	}
	this.setType(this.type);
}
/**
 * @private
 */
Point.prototype.setType = function(type){
	var topo = this.route.phototopo, point;
	if (!topo.options.showPointTypes){
		return;
	}
	this.type = type;

	if (this.iconEl){
		this.iconEl.remove();
	}
	this.iconEl = null;

	if (!type || type == '' || type == 'none' || type == 'hidden' || type == 'jumpoff'){
		if (this.nextPath){
			this.nextPath.redraw();
		}
		return;
	}
	if (this.nextPath){
		this.nextPath.redraw();
	}
	if (!this.iconEl){
		this.iconEl = topo.canvas.image(topo.options.baseUrl+'images/'+type+'.png', 0, 0, 16, 16);
		this.iconEl.toFront();
		this.iconEl.point = this;
		point = this;
		this.iconEl.hover(
			function(event){
				point.route.onmouseover();
			},
			function(event){
				point.route.onmouseout();
			}
		);
		this.iconEl.onclick = function(event){
			this.point.select(); // should this only be in edit mode?
			var opts = topo.options;
			if (opts.onclick){
				opts.onclick(this.point.route);
			}
		};
	}
	this.iconEl.className = 'pt_label pt_icon ' + this.type;
	this.updateIconPosition();

};
/**
 * @private
 */
Point.prototype.updateIconPosition = function(){
	var div = this.iconEl,
		offsetX = this.route.phototopo.options.editable ? 8 : -8,
		offsetY = -8,
		top, left;
	if (!div){ return; }
	left = this.x + offsetX;
	top  = this.y + offsetY;

	this.iconEl.attr({x: left, y: top });


};

/**
 * @private
 */
Point.prototype.setLabel = function(classes, text){

	var	label = this.labelEl,
		labelText = this.labelText,
		point = this,
		topo = this.route.phototopo,
		size = topo.options.labelSize,
		canvas = topo.canvas,
		styles = topo.styles;

	function clickHandler(event){
		point.select(); // should this only be in edit mode?
		var opts = topo.options;
		if (opts.onclick){
			opts.onclick(point.route);
		}
	};

	if (!this.labelEl){
		label = canvas.rect(this.x,this.y,size,size,0);
		label.attr({fill: 'yellow', width: size, height: size, stroke: 'black', 'stroke-width': topo.options.labelBorder });
		labelText = canvas.text(1,1,text);
		labelText.attr({
			width: size,
			height: size,
			'font-size': size*.68,
			'font-family': 'Helvetica'
		});
		this.labelText = labelText;

		this.labelEl = label;	
		label.mouseover(function(event){ point.route.onmouseover(); });
		label.mouseout(function(event){  point.route.onmouseout();  });
		labelText.mouseover(function(event){ point.route.onmouseover(); });
		labelText.mouseout(function(event){  point.route.onmouseout();  });

		label.click(clickHandler);
		labelText.click(clickHandler);

		if (!this.route.phototopo.loading){ 
			this.updateLabelPosition();
		}

	}

	if (classes.indexOf('selected') !== -1){
		    label.attr({fill: styles.strokeSelected.stroke, stroke: styles.outlineSelected.stroke });
		labelText.attr({fill: styles.outlineSelected.stroke });
	} else {
		if (this.route.autoColor){
			label.attr({fill: this.route.autoColor, stroke: this.route.autoColorBorder });
			if (this.route.autoColorText){
				labelText.attr({fill: this.route.autoColorText });
			} else {
				labelText.attr({fill: this.route.autoColorBorder });
			}
		} else {
			    label.attr({fill: styles.stroke.stroke, stroke: styles.outline.stroke });
			labelText.attr({fill: styles.outline.stroke });
		}
	}
	label.toFront();
	labelText.toFront();
	// TODO
	this.labelEl.className = 'pt_label '+classes;
};



/**
 * @private
 * remove a point from its route
 */
Point.prototype.remove = function(){

	var p = this,
		path = null,
		r, c;
	p.remove = 'todo';

	// remove handle from raphael
	p.circle.remove();

	// remove from point group
	p.pointGroup.remove(p);
	p.pointGroup.redraw();
	p.pointGroup = null;

	// remove all handlers for the point and refs to/from dom
	r = this.route;
	
	// remove point from array
	r.points.splice(p.position, 1);

	// fix all position's of points after this one
	for(c=p.position; c<r.points.length; c++){
		r.points[c].position = c;
	}

	// if one path then remove and relink
	if (p.prevPath){
		// remove prev path and relink
		path = p.prevPath;
		path.remove = 'now!';

		// fix point refs
		p.prevPoint.nextPoint = p.nextPoint;
		p.prevPoint.nextPath = p.nextPath;

		// fix path points
		if (p.nextPoint){	
			p.nextPoint.prevPoint = p.prevPoint;
		}
		if (p.nextPath){	
			p.nextPath.point1 = p.prevPoint;
		}

		r.paths.splice(p.position-1, 1);
		path.curve.remove();
		path.outline.remove();
		if (path.ghost){
			path.ghost.remove();
		}
		// select prev point
		p.prevPoint.select();
	} else if (p.nextPath){
		// it is the first
		// if the first point then move the label to the next point
		// select next point
		path = p.nextPath;
		path.remove = 'now2!';
		
		p.nextPoint.prevPoint = null;
		p.nextPoint.prevPath = null;
		
		r.paths.splice(p.position, 1);
		path.curve.remove();
		path.outline.remove();
		if (path.ghost){
			path.ghost.remove();
		}
		// select next point
		p.nextPoint.select();
	
	} else {
		
		// just one point so delete it
	}

	if (this.labelEl){
		this.labelEl.remove();
		this.labelText.remove();
		this.labelEl = null;
		this.labelText = null;
	}
	if (this.iconEl){
		this.iconEl.remove();
		this.iconEl = null;
	}

	if (this.route.phototopo.selectedPoint === this){
		this.route.phototopo.selectedPoint = null;
	}

	p.route.redraw();
	if (p.nextPoint){
		p.nextPoint.pointGroup.redraw();
	}
	if (p.prevPoint){
		p.prevPoint.pointGroup.redraw();
	}
	this.route.phototopo.saveData();
	$(this.route.phototopo.photoEl).removeClass('point');
	this.route.phototopo.updateCursor();

};

/**
 * @private
 * updates the labels position
 */
Point.prototype.updateLabelPosition = function(){

	var	label = this.labelEl,
		offsetX, offsetY,
		width, top, left,
		topo = this.route.phototopo,
		labelWidth = topo.options.labelSize;

	if (!label){ return; }

	
	offsetX = this.pointGroup.getSplitOffset(this) * labelWidth;

	width = (labelWidth) / 2;
	offsetY = topo.options.thickness;	

	left = this.x - width + offsetX;
	top  = this.y + offsetY;

	left = Math.round(left);
	top = Math.round(top);

	
	label.attr({x:left, y:top});

	left = left + width;
	top = top + width;
	this.labelText.attr({x:left, y:top});

};

/**
 * @private
 */
Point.prototype.setStyle = function(){
	var styles = this.route.phototopo.styles;
	if (this.circle){
		// if the active point			  
		if (this === this.route.phototopo.selectedPoint){
			this.circle.attr(styles.handleSelectedActive);
			/*
			this.circle.attr(styles.handleSelected);
			
			this.circle.animate(styles.handleSelectedActive, 500, function(){
				this.animate(styles.handleSelected, 500, function(){
					point.setStyle();
				});
			});
			*/
		} else if (this.route === this.route.phototopo.selectedRoute){
			// if any point on the selected route
			this.circle.animate(styles.handleSelected, 100);
		} else {
			// if any other point on another route
			this.circle.animate(styles.handle, 100);
			if (this.route.autoColor){
				this.circle.animate({'fill': this.route.autoColor}, 100);
			}
		}
	}
};

/**
 * @private
 * select the active point. new points on the route are added after this point
 * also explicitly selects the route the point is on
 */
Point.prototype.select = function(dontSelectRoute){
	
//	if (this.route.phototopo.selectedPoint === this) return;
	
	var previous = this.route.phototopo.selectedPoint;
	
	//this.route.phototopo.selectedPoint = this;
	if (!dontSelectRoute){
		this.route.select(this);
	}
	if (previous){
		previous.setStyle();
	}
		
	this.setStyle();
};



/**
 * @private
 * attempts to move the Point to a new location - it may not move due to 'stickyness' to itself and other points
 */
Point.prototype.moveTo = function(x,y){

	if (this.x === x && this.y === y){
		return { x: x, y: y };
	}
	if (isNaN(x) || isNaN(y) ){
		return { x: this.x, y: this.y };
	}

	this.pointGroup.remove(this);
	this.pointGroup.redraw();

	this.x = x;
	this.y = y;

	this.pointGroup = this.route.phototopo.getPointGroup(this);
	
	// retrive the x and y from the point group which might not be what we specified
	this.x = this.pointGroup.x;
	this.y = this.pointGroup.y;


	this.pointGroup.redraw();
	if (this.nextPoint){
		this.nextPoint.pointGroup.redraw();
	}
	if (this.prevPoint){
		this.prevPoint.pointGroup.redraw();
	}

	if (this.labelEl){
		this.updateLabelPosition();
	}

	this.updateIconPosition();

	this.route.phototopo.saveData();

	return { x: this.x, y: this.y };


};








/**
 * @private
 * a path connects two points
 * @constructor 
 * @param {Point} point1 The starting point
 * @param {Point} point2 The ending point
 */
function Path(point1, point2){

	function getID(){
		var id=0;
		return id++;
	}




	var offset, path, phototopo, options,nojs;

	this.point1 = point1;
	this.point2 = point2;
	this.id = getID();
	this.svg_part = '';
	this.point1.nextPath = this;
	this.point2.prevPath = this;

	phototopo = this.point1.route.phototopo;	
	options = phototopo.options;
	nojs = options.nojs;

	path = 'M'+this.point1.x+' '+this.point1.y+' L'+this.point2.x+' '+this.point2.y;
	this.svg_part = path;

	this.pathPart = ' L'+this.point2.x+' '+this.point2.y;


	this.outline = phototopo.canvas.path(path);
	if (!nojs){
		this.ghost   = phototopo.canvas.path(path);
	}
	this.outline.toBack();
	if (!nojs){
		this.ghost.toBack();
	}
	if (this.point1.route.phototopo.bg){
		this.point1.route.phototopo.bg.toBack();
	}

	this.curve      = phototopo.canvas.path(path);

	this.outline.attr(phototopo.styles.outline);
	if (this.point1.route.autoColorBorder){
		this.outline.attr('stroke', this.point1.route.autoColorBorder);
	}
	
	if (!nojs){
		this.ghost.attr  (phototopo.styles.ghost);
	}
	this.curve.attr  (phototopo.styles.stroke);

	if (this.point1.route.autoColor){
		this.curve.attr('stroke', this.point1.route.autoColor);
	}
	
	this.curve.path = this;
	this.outline.path = this;
	if (!nojs){
		this.ghost.path = this;
	}

	if (phototopo.options.editable){
// commented it out and it still works fine! TODO
//		this.point1.circle.toFront();
//		this.point2.circle.toFront();
	}
	
	this.curve.mouseover(function(event){	this.path.point1.route.onmouseover();	});
	this.outline.mouseover(function(event){	this.path.point1.route.onmouseover();	});
	this.curve.mouseout(function(event){	this.path.point1.route.onmouseout();	});
	this.outline.mouseout(function(event){	this.path.point1.route.onmouseout();	});
	if (!nojs){
		this.ghost.mouseover(function(event){	this.path.point1.route.onmouseover();	});
		this.ghost.mouseout(function(event){	this.path.point1.route.onmouseout();	});
	}
	
	
	function PathClick(event){
		var route = phototopo.selectedRoute,
			opts = phototopo.options;
			path = event.target.raphael.path;
		if (!phototopo.options.editable){
			this.path.point1.select();
			if (opts.onclick){
				opts.onclick(this.path.point1.route);
			}
			return;			
		}
		if (route){
			if (path.point1.route === route){
				path.point1.select();
			}
			offset = $(phototopo.photoEl).offset();

			route.addAfter(phototopo.selectedPoint,
				event.clientX - offset.left + $(window).scrollLeft(),
				event.clientY - offset.top  + $(window).scrollTop()  );
		} else {
			this.path.point1.select();
		}
	}

	this.curve.click(PathClick);
	this.outline.click(PathClick);
	if (!nojs){
		this.ghost.click(PathClick);
	}
}


/*
 * @private
 * changes the start point
 */
Path.prototype.redraw = function(point){
	var handle1 = this.point1.pointGroup.getAngle(this.point1),
		handle2 = this.point2.pointGroup.getAngle(this.point2),
		points,
		path,
		phototopo = this.point1.route.phototopo,
		path_finish = '',
		off1, off2, thickness,
		ddx, ddy,
		delta, angle, aWidth, aHeight, size,
		ex, ey;

	points = [
		this.point1,
		{x: this.point1.x + handle1.dx, y:this.point1.y + handle1.dy},
		{x: this.point2.x - handle2.dx, y:this.point2.y - handle2.dy},
		this.point2
	];
	
	
	/*
	 * takes a set of points that defines a bezier curve and offsets it
	 */
	function getBezierOffset(points, offset1, offset2){
	
		function secant(theta){
			return 1 / Math.cos(theta);
		}
	
		var res = [{}],
			c,
			angles = [],
			size = points.length -1,
			offset,
			offSec,
			angleAvg;
		for(c=0; c<3; c++){
			angles[c] = Math.atan2(points[c+1].y - points[c].y, points[c+1].x - points[c].x);
		}
		for(c=1; c<size; c++){
			offset = (offset1 * (size-c)) / size + (offset2 * c)/size;
			offSec = offset * secant((angles[c] - angles[c-1])/2);
			angleAvg = (angles[c]+angles[c-1])/2;
			res[c] = {
				x: points[c].x - offSec * Math.sin(angleAvg),
				y: points[c].y + offSec * Math.cos(angleAvg)
			};
		}
		res[0] = {
			x: points[0].x - offset1 * Math.sin(angles[0]),
			y: points[0].y + offset1 * Math.cos(angles[0])
		};
		res[size] = {
			x: points[size].x - offset2 * Math.sin(angles[size-1]),
			y: points[size].y + offset2 * Math.cos(angles[size-1])
		};
		for(c=0; c<res.length; c++){
			res[c].x = Math.round(res[c].x);
			res[c].y = Math.round(res[c].y);
		}
		return res;
	}



	if (phototopo.options.seperateRoutes){
		thickness = phototopo.options.thickness;
		off1 = this.point1.pointGroup.getSplitOffset(this.point1) * thickness * 1.4;
		off2 = this.point2.pointGroup.getSplitOffset(this.point2) * thickness * 1.4;
		points = getBezierOffset(points, off1, off2);
	}

	this.svg_part = 
		'C' + points[1].x + ' '+points[1].y +
		' ' + points[2].x + ' '+points[2].y +
		' ' + points[3].x + ' '+points[3].y;
		
	path = 'M' + points[0].x + ' '+points[0].y + this.svg_part;
		

	function offset(angle, x, y, dx, dy){
		ddx = Math.round((x - Math.sin(angle)*dx - Math.cos(angle)*dy)*10)/10;
		ddy = Math.round((y + Math.cos(angle)*dx - Math.sin(angle)*dy)*10)/10;
		return 'L'+ddx+' '+ddy+' ';
	}

	delta = this.point2.pointGroup.getAngle();
	angle = Math.atan2(delta.dy, delta.dx);
	size = phototopo.options.thickness * 0.5;

	// x,y of end point
	ex = points[3].x;
	ey = points[3].y;
	// draw a T bar stop
	if (!this.point2.nextPoint && this.point2.type === 'jumpoff'){
		aWidth = size*4;
		aHeight = size*0.1;

		path_finish += offset(angle, ex, ey,       0,  -aHeight   ); // bottom middle
		path_finish += offset(angle, ex, ey, -aWidth,  -aHeight   ); // bottom left
		path_finish += offset(angle, ex, ey, -aWidth,   aHeight   ); // top left
		path_finish += offset(angle, ex, ey,  aWidth,   aHeight   ); // top right
		path_finish += offset(angle, ex, ey,  aWidth,  -aHeight   ); // bottom left
		path_finish += offset(angle, ex, ey, -aWidth,  -aHeight   ); // bottom left
	
	// If this is the end of the Path then draw an arrow head
	} else if (!this.point2.nextPoint && (this.point2.type == 'none' || !this.point2.type) ){
		aWidth  = size*1.5;
		aHeight = size*1.5;
		path_finish += offset(angle, ex, ey,       0,  size*1.2   ); // middle
		path_finish += offset(angle, ex, ey, -aWidth,  aHeight    ); // bottom left
		path_finish += offset(angle, ex, ey,  aWidth,  aHeight    ); // bottom right
		path_finish += offset(angle, ex, ey,       0, -size*2.3   ); // top
		path_finish += offset(angle, ex, ey, -aWidth,  aHeight    ); // bottom left
		path_finish += offset(angle, ex, ey,  aWidth,  aHeight    ); // bottom right
	}
	this.svg_part += path_finish;
	path += path_finish;

	this.curve.attr('path', path);
	
	if (this.point1.type === 'hidden'){
		this.curve.attr(phototopo.styles.strokeHidden);
	} else {
		this.curve.attr(phototopo.styles.strokeVisible);
	}
	
	this.outline.attr('path', path);
	if (!phototopo.options.nojs){
		this.ghost.attr('path', path);
	}
};











/**
 * @constructor 
 * @param phototopo the topo to add this route to
 * @param id - is a unique string identifying the route (eg a primary id in the DB)
 * #param order is a number used for sorting the routes into a natural order (typically 1..x from left to right)
 * @property {String} id the unique id of this route
 
 */
function Route(phototopo, id, order){
	this.phototopo = phototopo;
	this.id = id;
	this.order = order ? order : id;
	this.points = [];
	this.paths = [];
	this.label = {};
}

/**
 * @private
 */
Route.prototype.addPoint = function(x,y,type,offset){

	var c, p, path;

	// if offset is not specified then add it at the end of the route
	if (offset === undefined || offset === null){
		offset = this.points.length;
	}
	x = Math.floor(x);
	y = Math.floor(y);

	p = new Point(this, x, y, type, offset);

	// fix next and prev pointers
	p.prevPoint = this.points[offset-1];
	if (p.prevPoint){
		p.nextPoint = p.prevPoint.nextPoint;
		p.nextPath = p.prevPoint.nextPath;
		p.prevPoint.nextPoint = p;
	}

	// what about p.next??
	
	// loop through and fix positions
	
	//each point has both next and prev points AND paths

	// add this point into the point list
	this.points.splice(offset, 0, p);


	// recalc the points positions
	for(c = this.points.length-1; c>offset; c--){
		this.points[c].position = c;
	}
	if (p.nextPoint){
		p.nextPoint.prevPoint = p;
	}

	// if more than one point make a path
	if(this.points.length >1){
		path = new Path(this.points[offset-1], this.points[offset]);
		this.paths.splice(offset-1, 0, path);
		if (this.paths[offset]){
			this.paths[offset].point1 = p;
		}
	}
	
	this.phototopo.saveData();
	this.phototopo.updateHint();

	if (p.nextPoint){
		p.nextPoint.pointGroup.redraw();
	}
	if (p.prevPoint){
		p.prevPoint.pointGroup.redraw();
	}
	p.pointGroup.redraw();

	return p;
};


/**
 * @private
 * add's a new point to a route, optionally after the point
 *
 */
Route.prototype.addAfter = function(afterPoint, x, y, type){
	
	var pos = afterPoint ? afterPoint.position+1 : null,
		newPoint = this.addPoint(x,y,type, pos);
	newPoint.select();

};


/**
 * @private
 * sets the label for this route
 * The label may appear in more than one place
 * if selected if will have a class of 'selected'
 * it may also have a class of 'start'
 */
Route.prototype.setLabel = function(label){
	this.label = label;
	if (this.label.label && this.points.length > 0){
		this.points[0].setLabel('start '+this.label.classes, this.label.label);
	}
	// else draw the label somewhere else so notify that it is missing??
};

/**
 * @private
 * serialise the point data and send back to the page to be saved 
 */
Route.prototype.getJSON = function(){
	var points = '',
		path = '',
		point,
		c;
	for(c=0; c<this.points.length; c++){
		point = this.points[c];
		if (c!== 0){
			points += ',';
		} else {
			path += 'M' + point.x + ' '+point.y;
		}
		points += point.x + ' ' + point.y;
		if (point.type && point.type != 'none'){
			points += ' ' + point.type;
		}
		if (point.nextPath){
			path += point.nextPath.svg_part;
		}
	}
	return {
		id: this.id,
		points: points,
		svg_path: path, 
		order: this.order
	};
};


/**
 * @private
 * select this route, and optionally specifies which point to select within the route
 * if no point specifices selects the last point in the route (if it has any points at all)
 */
Route.prototype.select = function(selectedPoint){
	var phototopo = this.phototopo,
		previousRoute = phototopo.selectedRoute,
		styles = phototopo.styles,
		c;
	
	if (phototopo.selectedRoute === this && selectedPoint === phototopo.selectedPoint){
		return;
	}
	

	if (previousRoute && previousRoute !== this){
		previousRoute.deselect();
	}
	
	phototopo.selectedRoute = this;
	
	if (this.label.label && this.points.length > 0){
		this.points[0].setLabel('selected start '+this.label.classes, this.label.label);
	}

	
	if (!selectedPoint){
		if (this.points.length > 0){
			selectedPoint = this.points[this.points.length-1];
		}
	}
	phototopo.selectedPoint = selectedPoint;
	if (selectedPoint){
		selectedPoint.select(true);
	}

	if (phototopo.options.onselect){
		phototopo.options.onselect(this);
	}
	
	// now highlight the new route and make sure it is at the front
	for(c=0; c< this.paths.length; c++){
		this.paths[c].outline.attr(styles.outlineSelected).insertBefore(phototopo.layerLabels);
	}
	for(c=0; c< this.paths.length; c++){
		this.paths[c].curve.attr(styles.strokeSelected).insertBefore(phototopo.layerLabels);
	}
	if (phototopo.options.editable === true){
		for(c=0; c< this.paths.length; c++){
			this.paths[c].point2.circle.attr(styles.handleSelected).insertBefore(phototopo.layerLabels);
		}
		if (this.points[0]){
			this.points[0].circle.attr(styles.handleSelected).insertBefore(phototopo.layerLabels);
		}
	}
	
	phototopo.updateHint();
	phototopo.updateCursor();

};

/**
 * @private
 * deselect this route
 */
Route.prototype.deselect = function(){

	var autoColor = this.autoColor,
	autoColorBorder = this.autoColorBorder,
	phototopo = this.phototopo,
	c;

	if (phototopo.options.ondeselect){
		phototopo.options.ondeselect(this);
	}

	phototopo.selectedRoute = null;
	phototopo.selectedPoint = null;


	for(c=0; c< this.paths.length; c++){
		this.paths[c].curve.attr(phototopo.styles.stroke);
		this.paths[c].outline.attr(phototopo.styles.outline);

		if (autoColor){
			this.paths[c].curve.attr('stroke', autoColor);
			this.paths[c].outline.attr('stroke', autoColorBorder);
		}
	}
	if (phototopo.options.editable === true){
		for(c=0; c< this.points.length; c++){
			this.points[c].circle.attr(phototopo.styles.handle);
			if (autoColor){
				this.points[c].circle.attr('fill', autoColor);
				this.points[c].circle.attr('stroke', autoColorBorder);
			}
		}
	}
	if (this.label.label && this.points.length > 0){
		this.points[0].setLabel('start '+this.label.classes, this.label.label);
	}
	phototopo.updateHint();
	phototopo.updateCursor();

};

/**
 * @private
 * redraw all components of this route 
 */
Route.prototype.redraw = function(){
	var c;
	for(c=0; c< this.paths.length; c++){
		this.paths[c].redraw();
	}
};

/**
 * @private
 */
Route.prototype.onmouseover = function(point){
	$(this.phototopo.photoEl).addClass('route');
	if (this === this.phototopo.selectedRoute){
		$(this.phototopo.photoEl).addClass('selectedRoute');
	}
	
	if (this.phototopo.options.onmouseover){
		this.phototopo.options.onmouseover(this);
	}
};

/**
 * @private
 */
Route.prototype.onmouseout = function(point){
	$(this.phototopo.photoEl).removeClass('route selectedRoute');
	
	if (this.phototopo.options.onmouseout){
		this.phototopo.options.onmouseout(this);
	}
};
/**
 * @private
 */
Route.prototype.onclick = function(point){
	if (this.phototopo.options.onclick){
		this.phototopo.options.onclick(this);
	}
};





/*
 * An area
 * @constructor 
 */
function Area(phototopo, id){
	this.phototopo = phototopo;
	this.id = id;
	this.vertices = [];
	this.edges = [];
	this.label = {
		x: '',
		y: '',
		align: '',
		text: ''
	};


	this.polygon = phototopo.canvas.path();
	this.polygon.attr(phototopo.styles.areaFill);

}


Area.prototype.getJSON = function(){

	var data = '', vertex,c;
	data += this.label.x + ' '+
		this.label.y + ' '+
		this.label.align + ' '+
		this.label.text+',';
	for(c=0; c<this.vertices.length; c++){
		vertex = this.vertices[c];
		if (c!== 0){
			data += ',';
		}
		data += vertex.x + ' ' + vertex.y;
	}

	return {
		id: this.id,
		points: data
	}
}

/*
 *
 */
Area.prototype.load = function(data, viewScale){
	// load up points
	// load up label

	this.orig = data;
	var points, pc, parts;
	if (data.points){
		points = data.points.split(',');
		for(pc = 0; pc < points.length; pc++){
			parts = points[pc].split(/\s/);
			if (pc==0){
				if (parts.length>3){
					this.label.x = parts[0];
					this.label.y = parts[1];
					this.label.align = parts[2];
					this.label.text = parts.slice(3).join(' ');
				}
				continue;
			}
			if (parts[0] === ''){
				parts.splice(0,1);
			}
			this.addVertex(parts[0]*viewScale, parts[1]*viewScale);
		}
	}
}

Area.prototype.redraw = function(){

	console.log('area draw');

	var v,e,c,svg_path,pt;


	if (this.vertices.length >2){
		v = this.vertices[this.vertices.length-1];
		e = v.area.fixPixel;
		pt = v.area.phototopo;
		svg_path = 'M'+e(v.x)+' '+e(v.y);
		for(c=0;c<this.vertices.length;c++){
			v = this.vertices[c];
			svg_path += ' L'+e(v.x)+' '+e(v.y);
		}

		this.polygon.attr('path', svg_path).insertBefore(pt.layerAreas);

	} else {
		

	}
}

/*
 * x
 * y
 * offset - insert at the nth position, otherwise add to end
 */
Area.prototype.addVertex = function(x,y,offset){

	var c, v, path;

	v = new Vertex(this, x, y);

	// if offset is not specified then add it at the end of the path
	if (offset === undefined || offset === null){
		offset = this.vertices.length;
	}

	// add this vertex into the vertices list
	this.vertices.splice(offset, 0, v);

	// rewire the next and prev links
	if (offset > 0){
		v.prev = this.vertices[offset-1];
		v.next = v.prev.next;
		v.prev.next = v;
		v.next.prev = v;
		v.redraw();
		v.prev.redraw();
	}


	this.redraw();	
	this.phototopo.saveData();

	return v;
};

function Vertex(area, x, y){
	this.area = area;
	this.x = x;
	this.y = y;

	this.next = this;
	this.prev = this; 
}

Vertex.prototype.redraw = function(){

	var e = this.area.fixPixel;
	this.svg_path = 'M'+e(this.x)+' '+e(this.y)+' L'+e(this.next.x)+' '+e(this.next.y);
	if (!this.border){
		var pt = this.area.phototopo;
		this.border = pt.canvas.path(this.svg_path);
		this.border.attr(pt.styles.areaBorder).insertBefore(pt.layerAreas);
	} else {
		this.border.attr('path', this.svg_path);
	}
}


Area.prototype.fixPixel = function(n){
	return n+.5;
}





/**
 * A widget for viewing and drawing climbing routes overlaid on a photo
 * @constructor 
 * @param {PhotoTopoOptions} opts The options for this phototopo
 */

function PhotoTopo(opts){



/**
 * A callback function
 * @constructor
 * @type Callback 
 * @param {Route} route The route
 */
PhotoTopo.Callback = function(){};
/**
 * The options to pass in when creating a topo
 * @constructor
 * @property elementId The id of the html div that the topo shold be created in
 * @property {Interger} width The width of the topo in pixels
 * @property {Interger} height The height of the topo in pixels
 * @property {String} imageUrl The url to the photo
 * @property {String} manualColor If you have autoColor turned off
 * @property {String} manualColorText If you have autoColor turned off
 * @property {String} manualColorBorder If you have autoColor turned off
 * @property  routes a json hash of routes. Each 
 * @property {Boolean} editable true if you want the widget to be editable
 * @property {Boolean} seperateRoutes If you want the routes to not overlap when they use the same points
 * @property {Boolean} autoColors If you want the color of the route to be inherited from the color of the label 
 * @property {Boolean} autoSize  If you want to set the image to not resize within the width and height set, eg stretch it (usually not what you want - needed for static export)
 * @property {Boolean} nojs Is there JS? If not then don't render the ghost path for click/hover events
 * @property {Integer} labelSize The label size in pixels
 * @property {Integer} labelBorder The thickness of the label border in pixels 
 * @property {Integer} thickness The thickness of the routes in pixels 
 * @property {Function} onmouseover  A callback with the Route
 * @property {Function} onmouseout A callback with the Route
 * @property {Function} onclick A callback with the Route
 * @property {Function} onselect A callback with the Route
 * @property {Function} ondeselect A callback with the Route
 * @property {Function} onchange A callback with a JSON dump of all route data to persist somehow
 * @property {Function} getlabel A function which when given a routeId should return a RouteLabel
 * @property {Boolean} showPointTypes If false point types are hidden (eg on small versions of a topo)
 * @property {Float} viewScale A scaling factor for drawing the topo						  
 */
PhotoTopo.Options = function(){};


/**
 * A label to be passed back to the getLabel callback
 * @constructor 
 * @property {String} label A small label for the route, eg a number, or the initials of the route name
 * @property {String} class A css class for styline
 */
PhotoTopo.RouteLabel = function(){};


	var errors = false,
		data,
		pc, c,
		label,
		tempEl,
		autoColor,
		autoColorText,
		autoColorBorder,
		viewScale, parts, points;
	
	/**
	 * @private
	 */
	function checkDefault(option, value){
		if (opts[option] === undefined){
			opts[option] = value;
		}
	}
	/**
	 * @private
	 */
	function missingError(exp, text){
		if (!exp){
			errors = true;
			throw('PhotoTopo config error: '+text);
		}
	}

	this.options = $.extend({}, this.defaultOptions);
	this.options = $.extend(this.options, opts);

	missingError(this.options, 'No options hash');
	missingError(this.options.elementId, 'No elementId');
	missingError(this.options.width, 'No width');
	missingError(this.options.height, 'No height');





/*
	missingError(this.options.origWidth, 'No origWidth');
	missingError(this.options.origHeight, 'No origHeight');
*/
	missingError(this.options.imageUrl, 'No imageUrl');
	
	this.photoEl = document.getElementById(this.options.elementId);
	this.photoEl.phototopo = this;
	this.photoEl.className = 'phototopo' + (this.options.editable === true ? ' editable' : '');

	
	this.canvas = Raphael(this.options.elementId, this.options.width, this.options.height);

	this.layerAreas = this.canvas.rect(1,1,0,0);
	this.layerLabels = this.canvas.rect(1,1,0,0);




	if (this.options.editable && !document.getElementById('#phototopoContextMenu') ){
		$('body').append(
'<ul id="phototopoContextMenu" class="contextMenu">'+
'    <li class="none"><a href="#">None</a></li>'+
'    <li class="jumpoff"><a href="#jumpoff">Jump off</a></li>'+
'    <li class="hidden"><a href="#hidden">Hidden</a></li>'+
'    <li class="separator">Protection</li>'+
'    <li class="bolt"><a href="#bolt">Bolt</a></li>'+
'    <li class="draw"><a href="#draw">Clip</a></li>'+
'    <li class="separator">Misc</li>'+
'    <li class="crux"><a href="#crux">Crux</a></li>'+
'    <li class="warning"><a href="#warning">Warning</a></li>'+
'    <li class="lower"><a href="#lower">Lower-off</a></li>'+
'    <li class="belay"><a href="#belay">Belay</a></li>'+
'    <li class="belaysemi"><a href="#belaysemi">Semi-belay</a></li>'+
'    <li class="belayhanging"><a href="#belayhanging">Hanging Belay</a></li>'+
'</ul>'
);
	}


	// size of visible image
	this.shownWidth = -1;
	this.shownHeight = -1;
	this.scale = 1;
	
	this.selectedRoute = null;
	this.selectedPoint = null;
	this.routesVisible = true;
	

	// a store for the routes
	this.routes = {};
	
	// point groups
	this.pointGroups = {};


	this.styles = {
		areaBorder: {
			'stroke': 'black', // default if it can't inherit from label colour
			'stroke-width': 15,
			'stroke-linejoin': 'miter',
			'stroke-linecap': 'round',
			'stroke-opacity': 1
		},
		areaFill: {
			'stroke': 'white',
			'stroke-width': 1,
			'stroke-linejoin': 'miter',
			'stroke-linecap': 'round',
			'stroke-opacity': 1,
			'fill-opacity': .01,
			'fill': 'white'
		},
		outline: {
			'stroke': 'black', // default if it can't inherit from label colour
			'stroke-width': this.options.thickness * 1.7,
			'stroke-linejoin': 'miter',
			'stroke-linecap': 'round',
			'stroke-opacity': 1 
		},
		outlineSelected: {
			'stroke': 'white' // default if it can't inherit from label colour
		},
		ghost: {
			'stroke': 'red',
			'stroke-width': this.options.thickness * 4,
			'stroke-linejoin': 'miter',
			'stroke-linecap': 'round',
			'stroke-opacity': 0.01 
		},
		stroke: {
			'stroke': 'yellow',
			'stroke-width': this.options.thickness,
			'stroke-linejoin': 'miter',
			'stroke-linecap': 'round',
			'stroke-opacity': 1 
		},
		strokeSelected: {
			'stroke-width': this.options.thickness,
			'stroke': '#3D80DF' // default if it can't inherit from label colour
		},
		strokeVisible: {
			'stroke-dasharray': 'none' // If none makes svg bug? if inheret makes another bug where the hidden is 'stuck' after its visible
		},
		strokeHidden: {
			'stroke-dasharray': '.'
		},
		handle: {
			'stroke': 'black', // default if it can't inherit from label colour
			'r': this.options.thickness * 1.2,
			'fill': 'yellow',
			'stroke-width': this.options.thickness * 0.4
		},
		handleHover: {
			'fill': 'white'
		},
		handleSelected: {
			'fill': '#3D80DF',
			'stroke': 'white' // default if it can't inherit from label colour
		},
		handleSelectedActive: {
			'fill': '#fff' // same as handle selected stroke colour
		}
	};


	if (errors){
		return;
	}



	// colour the background
	this.setImage(this.options.imageUrl);	

	// Now draw the routes
	// ALL of this logic should be inside the Route class!!
	this.loading = true;
	viewScale = this.options.viewScale;
	for(c=0; c<this.options.routes.length; c++){
		data = {};
		data = this.options.routes[c];
		if (this.routes[data.id]){
			alert('Error: duplicate route=['+data.id+'] '+this.options.elementId);
		}
		if (data.type == 'area'){
			var area = this.routes[data.id] = new Area(this, data.id);
			area.load(data, viewScale);
			continue;
		}
		this.routes[data.id] = new Route(this, data.id, data.order);
		this.routes[data.id].orig = data;
		if (this.options.getlabel){
			label = this.options.getlabel(data);
			if (this.options.autoColors){
				tempEl = $("<div class='labels'><div class='"+label.classes+"'/></div>");
				this.photoEl.appendChild(tempEl[0]);
				autoColor       = tempEl.children().css('background-color');
				autoColorText   = tempEl.children().css('color');
				autoColorBorder = tempEl.children().css('border-top-color');
				this.photoEl.removeChild(tempEl[0]);
				this.routes[data.id].autoColor = autoColor;
				this.routes[data.id].autoColorText = autoColorText;
				this.routes[data.id].autoColorBorder = autoColorBorder;
			}
		}
		if (data.manualColor){
			this.routes[data.id].autoColor = data.manualColor;
		}
		if (data.manualColorText){
			this.routes[data.id].autoColorText = data.manualColorText;
		}
		if (data.manualColorBorder){
			this.routes[data.id].autoColorBorder = data.manualColorBorder;
		}
		if (data.points){
			points = data.points.split(',');
			for(pc = 0; pc < points.length; pc++){
				parts = points[pc].split(/\s/);
				if (parts[0] === ''){
					parts.splice(0,1);
				}
				this.addToRoute(data.id, parts[0]*viewScale, parts[1]*viewScale, parts[2]);
			}
		}
		if (this.options.getlabel){
			label = this.options.getlabel(data);
			this.routes[data.id].setLabel(label);
		}
	

	}
	this.loading = false;

	this.redraw();
	this.saveData();
	
	this.updateHint();
	this.updateCursor();	
}

/*
 * default options
 */
PhotoTopo.prototype.defaultOptions = {
	'autoSize': true,
	'thickness': 5,
	'labelSize': 16,
	'labelBorder': 1,
	'viewScale': 1,
	'nojs': false,
//	'baseUrl': '../src/',
	'baseUrl': '/static/bheywood/phototopo-1.2.2/',
	'showPointTypes': true,
//	'onchange': function(){},

};



/**
 * Sets wether the route lines are visible
 * @param {Boolean} visible if true makes the routes visible
 */
PhotoTopo.prototype.setRouteVisibility = function(visible){
	var phototopo = this;
	phototopo.routesVisible = visible;
	if (!phototopo.hide){
		phototopo.hide = phototopo.bg.clone();
		phototopo.hide.attr('opacity', 0.8);
	}
	if (visible){
		phototopo.hide.toBack();
	} else {
		phototopo.hide.toFront();
	}
};

/**
 * @private
 */
PhotoTopo.prototype.updateHint = function(){
	if (!this.options.editable){
		return;
	}

	if (this.selectedRoute === null){
		this.setHint('Select the route you wish to draw or edit in the table below');
	} else if (this.selectedRoute.points.length === 0){
		this.setHint('Click at the beginning of the route to start drawing this route');
	} else {
		this.setHint('Click to add or select, then drag to move. Double click to remove');
	}

};

/**
 * @private
 */
PhotoTopo.prototype.setHint = function(hintHTML){
	if (!this.hintEl){
		this.hintEl = $('<div class="hint ui-state-highlight"></div>').show('slide').appendTo(this.photoEl)[0];
	}
	this.hintEl.innerHTML = '<span class="ui-icon ui-icon-info" style="float: left;"></span><strong>Hint:</strong> '+hintHTML;
	$(this.hintEl).offset(0,0);
};


/**
 * Selects the route with a given id
 * @param {Route} route the route to select
 * @param {Boolean} [toggle] if true and the route is already selected will delesect
 */
PhotoTopo.prototype.selectRoute = function(routeId, toggle){
	
	if (this.routes[routeId]){
		if (toggle && this.routes[routeId] === this.selectedRoute){
			this.selectedRoute.deselect();
		} else {
			this.routes[routeId].select();
			return this.routes[routeId];
		}
	} else {
		if (this.selectedRoute){
			this.selectedRoute.deselect();
		}
	}
};



/**
 * @private
 * save the data down to the page to be serialised in some form
 * @returns a json strucure with all point data
 */
PhotoTopo.prototype.saveData = function(){
	var routeId,
		data = {routes: [], changed: false },
		route, routeData;
	if (this.loading){
		return;
	}
	if (this.changed){
		data.changed = true;
	}
	if (!this.changed){
		this.changed = true;
	}
	if (!this.options.onchange ){
		return;
	}
	
	for(routeId in this.routes){
		route = this.routes[routeId];
		data.routes[data.routes.length] = route.getJSON();
	}

	this.options.onchange(data);

};

/**
 * @private
 */
PhotoTopo.prototype.redraw = function(){
	var routeId, r;
	for(routeId in this.routes){
		r = this.routes[routeId];
		r.redraw();

		// dirty hack? should be inside the route object
		if (r.points && r.points.length){
			r.select(); // select them all to flush the outline z-index
			r.points[0].updateLabelPosition();
		}
	}
	this.selectRoute(); // select nothing
};


/**
 * @private
 * creates or retreives a point group for a new point location
 * if the point is close to another point it will 'stick' the point to the previous point
 */
PhotoTopo.prototype.getPointGroup = function(point){

	var x = point.x,
		y = point.y,
		key,
		group;

	x = Math.round(x);
	y = Math.round(y);

	// make sures it's inside the picture
	if (x<0){ x = 0;}
	if (y<0){ y = 0;}
	if (x>this.shownWidth ){ x = this.shownWidth; }
	if (y>this.shownHeight){ y = this.shownHeight;}

	key = this.getKey(point);
	group = this.pointGroups[key];
		
	point.x = x;
	point.y = y;
	
	if(group){
		group.add(point);
	} else {
		group = new PointGroup(point);
		this.pointGroups[key] = group;
	}

	return group;
		
};

/**
 * @private
 * given an x,y coord return a key for saving this
 */
PhotoTopo.prototype.getKey = function(point){
	var
	threshhold = this.options.thickness * 4,
	tx = point.x - point.x % threshhold + threshhold / 2,
	ty = point.y - point.y % threshhold + threshhold / 2;
	return tx + '_' + ty;
};



/**
 * @private
 * Adds or inserts a new Point into a route
 */
PhotoTopo.prototype.addToRoute = function(routeId, x, y, type, position){
	this.routes[routeId].addPoint(x,y,type,position);
	
};



/**
 * Set the photo image and triggers a redraw
 * @param {String} imageUrl a url to an image
 */
PhotoTopo.prototype.setImage = function(imageUrl){
		
	var phototopo = this,
		options = phototopo.options,
		img = new Image();
		
	
	// Set these first so we have a workable size before the image gets loaded asynchronously
	this.shownWidth  = this.options.width;
	this.shownHeight = this.options.height;
	
	options.imageUrl = imageUrl;

	if (options.autoSize){
		$(img).load(function(){
			options.origWidth = img.width;
			options.origHeight = img.height;

			phototopo.shownWidth = img.width;
			phototopo.shownHeight = img.height;
			if (phototopo.shownHeight > options.height){
				phototopo.scale = options.height / phototopo.shownHeight;
				phototopo.shownHeight *= phototopo.scale;
				phototopo.shownWidth *= phototopo.scale; 
			}
			if (phototopo.shownWidth > options.width){
				phototopo.scale = phototopo.scale * options.width / phototopo.shownWidth;
				phototopo.shownHeight = options.origHeight * phototopo.scale;
				phototopo.shownWidth  = options.origWidth  * phototopo.scale; 
			}


			options.imageUrl = imageUrl;
			if (phototopo.bg){
				phototopo.bg.remove();
			}
			phototopo.bg = phototopo.canvas.image(options.imageUrl, 0, 0, phototopo.shownWidth, phototopo.shownHeight);
			phototopo.bg.click(function(event){
				phototopo.clickBackground(event);
			});
								 
			phototopo.bg.toBack();
		})
		.attr('src', imageUrl);
	} else {
		options.imageUrl = imageUrl;
		if (phototopo.bg){
			phototopo.bg.remove();
		}
		phototopo.bg = phototopo.canvas.image(options.imageUrl, 0, 0, phototopo.shownWidth, phototopo.shownHeight);
		phototopo.bg.click(function(event){
			phototopo.clickBackground(event);
		});
					 
		phototopo.bg.toBack();
	}

};


/**
 * @private
 * handle a click on the background
 * if in edit mode and a point is selected then insert it
 */
PhotoTopo.prototype.clickBackground = function(event){
	
	if (this.options.editable){
		if (this.selectedRoute){
			var offset = $(this.photoEl).offset();
			this.selectedRoute.addAfter(this.selectedPoint, event.clientX - offset.left + $(window).scrollLeft(), event.clientY - offset.top + $(window).scrollTop(), '');
		} else {
			this.setHint('First select a route or point');
		}
	}
	this.updateCursor();
	if (this.options.onclick){
		this.options.onclick();
	}
	
};

/**
 * @private
 */
PhotoTopo.prototype.updateCursor = function(){
	var cursor = '',
	jq = $(this.photoEl);
	
	if (!this.selectedRoute){
		cursor = 'noneselected';
	} else {
	// if no route selected then show a 'selectabke' on a mouseover'
	
		if (this.selectedRoute.points.length === 0){
			cursor = 'addfirst';
		} else {
			cursor = 'addmore';
		}
	
	}
	// if a route selected but no points show a 'addfirst'
	// otherwise show a 'add'

	// if mouseover a point then show a 'draggable'
	jq.removeClass('noneselected addfirst addmore');
	jq.addClass(cursor);
};
/**
 * Sets the order of the routes which affects the way they visually thread through each point
 * @param order a hash of the id to the order
 */
PhotoTopo.prototype.setOrder = function(order){

	// reorder all the routes
	var id, label;
	for(id in order){
		if (this.routes[id]){
			this.routes[id].order = order[id];
			if (this.options.getlabel){
				label = this.options.getlabel(this.routes[id]);
				this.routes[id].setLabel(label);
			}
		}
	}
	
	// refresh the render
	for(id in this.pointGroups){
		this.pointGroups[id].sort();
		this.pointGroups[id].redraw();
	}

	this.saveData();
};
