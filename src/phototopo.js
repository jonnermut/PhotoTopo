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
		offsetX, offsetY=0,
		width, top, left,
		topo = this.route.phototopo,
		labelWidth = topo.options.labelSize;
	if (!label){ return; }

	width = (labelWidth) / 2;
	
	offsetX = this.pointGroup.getSplitOffset(this) * labelWidth;
	// find out which compas direction the route is heading in
	if (this.nextPoint){
		var dy = this.nextPoint.y - this.y;
		var dx = this.nextPoint.x - this.x;
		var adx = Math.abs(dx);
		var ady = Math.abs(dy);
		if (adx < ady){
			// top
			offsetY = width * 2;
			// bottom
			if (dy > 0){
				offsetX = -offsetX;
				offsetY = -offsetY;
			}
		} else {
			// left
			offsetY = offsetX;
			offsetX = -width * 2;
			// right
			if (dx < 0){
				offsetY = -offsetY;
				offsetX = -offsetX;
			}
		}
	} else {
		// no second point so position under
		offsetY = width * 2;
		offsetX = -offsetX;
	}

	left = this.x - width + offsetX;
	top  = this.y - width + offsetY;

	left = Math.round(left);
	top = Math.round(top);

	
	if (top  < 0){ top  = 0; }
	if (left < 0){ left = 0; }
	if (top  > topo.options.height - labelWidth){ top  = topo.options.height - labelWidth; }
	if (left > topo.options.width  - labelWidth){ left = topo.options.width  - labelWidth; }

	
	label.attr({x:left, y:top});

	left = left + width;
	top = top + width;
	this.labelText.attr({x:left, y:top});

};

/**
 * @private
 */
Point.prototype.setStyle = function(){

	var node = this.route ? this.route : this.polygon ? this : this.area;

	var styles = node.phototopo.styles;
	if (this.circle){
		// if the active point			  
		if (this === node.phototopo.selectedPoint){
			this.circle.attr(styles.handleSelectedActive);
			/*
			this.circle.attr(styles.handleSelected);
			
			this.circle.animate(styles.handleSelectedActive, 500, function(){
				this.animate(styles.handleSelected, 500, function(){
					point.setStyle();
				});
			});
			*/
		} else if (node === node.phototopo.selectedRoute){
			// if any point on the selected route
			this.circle.animate(styles.handleSelected, 100);
		} else {
			// if any other point on another route
			this.circle.animate(styles.handle, 100);
			if (node.autoColor){
				this.circle.animate({'fill': node.autoColor}, 100);
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

	function mouseover(event){
		this.path.point1.route.onmouseover();
		$(this.path.point1.route.phototopo.photoEl).addClass('split');
		this.path.point1.route.phototopo.updateCursor();
	}
	function mouseout(event){	
		this.path.point1.route.onmouseout();
		$(this.path.point1.route.phototopo.photoEl).removeClass('split');
		this.path.point1.route.phototopo.updateCursor();
	}
	this.curve.mouseover(   mouseover );
	this.curve.mouseout(    mouseout  );
	this.outline.mouseover( mouseover );
	this.outline.mouseout(  mouseout  );
	if (!nojs){
		this.ghost.mouseover( mouseover );
		this.ghost.mouseout(  mouseout );
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
		var ddx = Math.round((x - Math.sin(angle)*dx - Math.cos(angle)*dy)*10)/10;
		var ddy = Math.round((y + Math.cos(angle)*dx - Math.sin(angle)*dy)*10)/10;
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
//		svg_path: path, 
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
function Area(phototopo, id,order){
	this.phototopo = phototopo;
	this.id = id;
	this.order = order;
	this.vertices = [];
	this.edges = [];
	this.label = {
		x: -1,
		y: -1,
		visible: 'v',
		line:    'n',
		valign:  'b',
		halign:  'l',
		wid:     'd',
		text:    ''
	};


	this.polygon = phototopo.canvas.path().attr(phototopo.styles.areaFill);

	var area = this;
	
	this.click = function(event){

		var opts = phototopo.options;
		if (opts.editable){
			if (area.phototopo.selectedRoute === area){
				area.deselect();
				return;
			}
			area.select();
			return;
		}
		if (opts.onclick){
			opts.onclick(area);
		}
	};
	this.mouseover = function(e){
		var opts = phototopo.options;
		if (opts.onmouseover){
			opts.onmouseover(area);
		}
	};

	this.mouseout = function(e){
		var opts = phototopo.options;
		if (opts.onmouseout){
			opts.onmouseout(area);
		}
	};

	this.polygon.click(    this.click);
	this.polygon.mouseover(this.mouseover);
	this.polygon.mouseout( this.mouseout);

}



Area.prototype.getJSON = function(){

	var data = '', vertex,c;
	if (this.label.x){
	data += this.label.x + ' '+
		this.label.y + ' '+
		this.label.halign + 
		this.label.valign +
		this.label.visible +
		this.label.line +
		this.label.wid +
		' '+
		encodeURIComponent(this.label.text);
	}
	for(c=0; c<this.vertices.length; c++){
		vertex = this.vertices[c];
		data += ',';
		data += vertex.x + ' ' + vertex.y;
	}

	return {
		id: this.id,
//		type: 'area',
		order: this.order,
		points: data
	}
}

/*
 *
 */
Area.prototype.load = function(data, viewScale, label){
	// load up points
	// load up label

	this.orig = data;
	var points, pc, parts;
	if (data.points){
		points = data.points.split(',');
		for(pc = 0; pc < points.length; pc++){
			parts = points[pc].split(/\s/);
			if (parts[0] == ''){ continue; }
			if (pc==0){
				if (parts.length>3){
					this.label.x = Math.round(parts[0] * viewScale * 10)/10;
					this.label.y = Math.round(parts[1] * viewScale * 10)/10;
					var op = parts[2];
					this.label.halign  = op.charAt(0) || 'l';
					this.label.valign  = op.charAt(1) || 'b';
					this.label.visible = op.charAt(2) || 'v';
					this.label.line    = op.charAt(3) || 'n';
					this.label.wid     = op.charAt(4) || 'a';
					this.label.text = decodeURIComponent( parts[3] );
				}
				continue;
			}
			if (parts[0] === ''){
				parts.splice(0,1);
			}
			this.addVertex(Math.round( parts[0]*viewScale * 10)/10, Math.round(parts[1]*viewScale*10)/10 );
		}
	} else {
		this.label.text = label;
	}
	this.select();
	this.deselect();
}

Area.prototype.drawLabel = function(){

}

/*
 *
 * handle - option bool, should it move the handle as well?
 */
Area.prototype.moveTo = function(x,y,handle){

	var pos = this.snap(x,y);
	x = pos.x;
	y = pos.y;

	if (this.x === x && this.y === y){
		return { x: x, y: y };
	}
	if (isNaN(x) || isNaN(y) ){
		return { x: this.x, y: this.y };
	}

	this.label.x = x;
	this.label.y = y;

	if (handle && this.circle){
		this.circle.attr({cx:x,cy:y});
	}

	this.redraw();

	this.phototopo.saveData();

	return { x: x, y: y };


};

Area.prototype.redrawLabel = function(){

	var l = this.label;
	var c,v;
	var pt = this.phototopo;

	if (!this.labelEl){
		this.labelEl = pt.canvas.text(0, 0,l.text);
		this.labelEl.click(    this.click);
		this.labelEl.mouseover(this.mouseover);
	//	this.labelEl.mouseout( this.mouseout);
	}

	this.labelEl.attr({
		text: l.text,
	});

	var padding = 2;
	var bbox = this.labelEl.getBBox();
	var width = bbox.width * 1 + padding*2;
	var height = bbox.height * 1 + padding *2;


	// is it magic docked?
	var dock = null;
	var dockW = -1;
	this.docked = false;
	if (l.wid == 'd'){
		// find out what point it is docked with
		for(c=0;c<this.vertices.length;c++){
			v = this.vertices[c];
			if (v.x == l.x && v.y == l.y){
				dock = v;
			}
		}

		// ok now find the width of any horizontal
		if (dock){
			if (dock.y == dock.next.y){
				dockW = Math.abs(dock.x - dock.next.x);
			}
			if (dock.y == dock.prev.y){
				dockW = Math.abs(dock.x - dock.prev.x);
			}
		}
		// only dock if it is longer!
		if (dockW > width){
			width = dockW;
			this.docked = width;
		}
	}



	// x,y are always the top left corner of the box
	// tx,ty are the anchor for the text
	var x = l.x * 1;
	var tx = x;
	if (l.halign == 'l'){                 tx += padding; }
	if (this.docked){
		if (l.halign == 'c'){ tx += width/2;                 }
		if (l.halign == 'r'){ tx += width-padding;           }
	} else {
		if (l.halign == 'c'){ x -= width/2;   tx -= 0;       }
		if (l.halign == 'r'){ x -= width;     tx -= padding; }
	}
	var y = l.y * 1;
	var ty = y;
	if (l.valign == 'b'){ y -= height;    ty -= height/2; }
	if (l.valign == 'm'){ y -= height/2;                  }
	if (l.valign == 't'){                 ty += height/2; }


	this.labelEl.attr({
		x: tx,
		y: ty,
		'font-size': 12,
		'font-family': 'Helvetica',
		'text-anchor': (l.halign == 'l' ? 'start' : l.halign == 'c' ? 'middle' : 'end')
	}).attr( this == pt.selectedRoute ? pt.styles.areaLabelTextSelected : pt.styles.areaLabelText )

	
	if(!this.labelBox){
		this.labelBox = pt.canvas.rect(x,y,width,height,0);
		this.labelBoxShadow = pt.canvas.rect(x,y,width,height,0);
		this.labelBox.click(    this.click);
		this.labelBox.mouseover(this.mouseover);
		this.labelBox.mouseout( this.mouseout);
	}
	this.labelBox.attr({
		x: x,
		y: y,
		width: width,
		height: height,
	})
	.attr( this == pt.selectedRoute ? pt.styles.areaLabelSelected : pt.styles.areaLabel )
	this.labelBox.insertBefore(this.labelEl);

	this.labelBoxShadow.attr({
		x: x,
		y: y,
		width: width,
		height: height,
	})
	.attr( this == pt.selectedRoute ? pt.styles.areaLabelShadowSelected : pt.styles.areaLabelShadow )
	this.labelBoxShadow.insertBefore(pt.layerShadows);


	function dragStart(){
		var selectedRoute = this.point.phototopo.selectedRoute;
		$(this.point.phototopo.photoEl).addClass('dragging');

		this.ox = this.attr("cx");
		this.oy = this.attr("cy");
			
		// don't allow draging of points if another route is selected
		if (selectedRoute && selectedRoute !== this.point){
			return;
		}
		circle.animate(styles.handleHover, 100);
		this.point.select();
	}

	function dragMove(dx, dy){
		var selectedRoute = this.point.phototopo.selectedRoute, pos;
		if (selectedRoute && selectedRoute !== this.point){
			return;
		}
		pos = circle.point.moveTo(Math.round(this.ox*1 + dx), Math.round(this.oy*1 + dy));
		circle.attr({cx: pos.x, cy: pos.y});
	}

	function dragEnd(){
		var selectedRoute = this.point.phototopo.selectedRoute;
		$(this.point.phototopo.photoEl).removeClass('dragging');

		if (selectedRoute && selectedRoute !== this.point){
			return;
		}
		this.point.setStyle();
	}

	var circle;
	var styles = pt.styles;
	if (pt.options.editable){

		if (!this.circle){
			this.circle = pt.canvas.circle(l.x, l.y, 5);
			circle = this.circle;
			circle.point = this;
			circle.attr(styles.handleArea);
		
			circle.drag(dragMove, dragStart, dragEnd); 
			circle.mouseover(function(){

				$(this.point.phototopo.photoEl).addClass('point');
				this.point.setStyle();
				this.point.onmouseover(this.point);
				this.animate(styles.handleHover, 100);
			});
			circle.mouseout(function(){
				if (!this.point)return;
				$(this.point.phototopo.photoEl).removeClass('point');
				this.point.onmouseout(this.point);
				this.point.setStyle();
			});
		} else {
			this.circle.attr({x:l.x,y:l.y});	
		}
		this.circle.toFront();
		this.setStyle();
	}

}

Area.prototype.redraw = function(){

	var v,e,c,svg_path;
	var l = this.label;
	var pt = this.phototopo;


	this.redrawLabel();

	var bbox = this.labelEl.getBBox();



	function offset(angle, x, y, dx, dy){
		var ddx = Math.round((x - Math.sin(angle)*dx - Math.cos(angle)*dy)*10)/10;
		var ddy = Math.round((y + Math.cos(angle)*dx - Math.sin(angle)*dy)*10)/10;
		return 'L'+ddx+' '+ddy+' ';
	}


	if (this.vertices.length > 0){

	
		v = this.vertices[this.vertices.length-1];

		e = v.area.fixPixel;
		svg_path = 'M'+e(v.x)+' '+e(v.y);
		for(c=0;c<this.vertices.length;c++){
			v = this.vertices[c];
			v.redraw();
			svg_path += ' L'+e(v.x)+' '+e(v.y);
		}
		this.polygon.attr('path', svg_path)
			.attr( this == pt.selectedRoute ? pt.styles.areaFillSelected : pt.styles.areaFill )
			.attr( this.label.visible == 'v' ? pt.styles.areaFillVisible : pt.options.editable ? pt.styles.areaFillEditHidden : pt.styles.areaFillHidden )
			.show();

		// if we want a line
		if (l.line == 'y' || l.line == 'p'){
			bbox = this.polygon.getBBox();

			var sx = l.x;
			var sy = l.y;

			if (this.docked){
				if (l.halign == 'c'){ sx += this.docked/2; }
				if (l.halign == 'r'){ sx += this.docked;   }
			}
			var end = {x: bbox.x+bbox.width/2, y:bbox.y+bbox.height/2 };
			var svg = "M"+sx+' '+sy+', L'+end.x+' '+end.y;

			if (l.line == 'p'){
				var angle = Math.atan2(end.y - sy, end.x - sx);
				var path_finish = '';
				var size = 1;
				var ex = end.x, ey = end.y;
				var aWidth  = size*1.5;
				var aHeight = size*1.5;
				path_finish += offset(angle, ex, ey,       0,  size*1.2   ); // middle
				path_finish += offset(angle, ex, ey, -aWidth,  aHeight    ); // bottom left
				path_finish += offset(angle, ex, ey,  aWidth,  aHeight    ); // bottom right
				path_finish += offset(angle, ex, ey,       0, -size*2.3   ); // top
				path_finish += offset(angle, ex, ey, -aWidth,  aHeight    ); // bottom left
				path_finish += offset(angle, ex, ey,  aWidth,  aHeight    ); // bottom right
				svg += path_finish;
			}

			if (!this.labelLine){
				this.labelLine = this.phototopo.canvas.path(svg);
				this.labelLine.insertBefore(this.labelBox);
				this.labelLineShad = this.phototopo.canvas.path(svg);
				this.labelLineShad.insertBefore(this.labelLine);
				this.labelLine.click(    this.click);
				this.labelLine.mouseover(this.mouseover);
				this.labelLine.mouseout( this.mouseout);
			} else {
				this.labelLine.attr('path', svg);
				this.labelLineShad.attr('path', svg);
			}
			this.labelLine
				.attr( this == pt.selectedRoute ? pt.styles.areaLabelLineSelected : pt.styles.areaLabelLine )
				.show()
			this.labelLineShad
				.attr( this == pt.selectedRoute ? pt.styles.areaBorderSelected : pt.styles.areaBorder )
				.show()
		
		} else {
			this.labelLine && this.labelLine.hide();
			this.labelLineShad && this.labelLineShad.hide();
		}
	} else {
		this.polygon   && this.polygon.hide();
		this.labelLine && this.labelLine.hide();
		this.labelLineShad && this.labelLineShad.hide();
	}
}


Area.prototype.select = function(selectedPoint){
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
	
	if (!selectedPoint){
		if (this.vertices.length > 0){
			selectedPoint = this.vertices[this.vertices.length-1];
		}
	}
	phototopo.selectedPoint = selectedPoint;
	if (selectedPoint){
		selectedPoint.select(true);
	}

	if (phototopo.options.onselect){
		phototopo.options.onselect(this);
	}
	
	// now highlight the new route and make sure it is at the front of the other area, but behind any routes
	for(c=0; c< this.vertices.length; c++){
		this.vertices[c].border.insertBefore(phototopo.layerAreas);
	}

	if (this.vertices[0] && this.vertices[0].ghost){
		for(c=0; c< this.vertices.length; c++){
			this.vertices[c].ghost.insertBefore(phototopo.layerAreas);
		}
	}
	this.polygon.insertBefore(phototopo.layerAreas);


	if (phototopo.options.editable == true){
		for(c=0; c< this.vertices.length; c++){
			this.vertices[c].circle.attr(styles.handleSelected).toFront();
		}

		this.showOptions();	

	} else {

	}
	
	this.redraw();
	phototopo.updateHint();
	phototopo.updateCursor();

};

Area.prototype.showOptions = function(){

	var pt = this.phototopo;
	if (pt.loading){ return; }

	function silk(i){
		return '<img src="https://static.thecrag.com/silk/'+i+'.png" width="16">';
	}

	var e = pt.areaOptionsEl;
	if (!e){
		e = $('<div class="areaoptions well form-inline"">'+
			'<label>Label:'+
			'<div class="btn-group"><textarea name="label" style="width:200px;" rows="2"></textarea></div></label>'+
			' <label>Align: '+
			'<div class="btn-group">'+
				'<button name="halign" value="l" class="btn btn-mini">'+silk('text_align_left'   )+'</button>'+ 
				'<button name="halign" value="c" class="btn btn-mini">'+silk('text_align_center' )+'</button>'+ 
				'<button name="halign" value="r" class="btn btn-mini">'+silk('text_align_right'  )+'</button>'+ 
			'</div></label>'+ 
			' <label>Vertical: '+
			'<div class="btn-group">'+
				'<button name="valign" value="b" class="btn btn-mini">'+silk('shape_align_bottom')+'</button>'+ 
				'<button name="valign" value="m" class="btn btn-mini">'+silk('shape_align_middle')+'</button>'+ 
				'<button name="valign" value="t" class="btn btn-mini">'+silk('shape_align_top'   )+'</button>'+ 
			'</div></label>'+ 
			' <label>Shape: '+
			'<div class="btn-group">'+
				'<button name="visible" value="v" class="btn btn-mini">Visible</button>'+ 
				'<button name="visible" value="h" class="btn btn-mini">Hidden</button>'+ 
			'</div></label>'+ 
			' <label>Pointer: '+
			'<div class="btn-group">'+
				'<button name="line" value="n" class="btn btn-mini">No</button>'+ 
				'<button name="line" value="y" class="btn btn-mini">Yes</button>'+ 
				'<button name="line" value="p" class="btn btn-mini">Arrow</button>'+ 
			'</div></label>'+ 
			' <label>Auto width: '+
			'<div class="btn-group">'+
				'<button name="wid" value="d" class="btn btn-mini">Expand</button>'+ 
				'<button name="wid" value="a" class="btn btn-mini">Shrink</button>'+ 
			'</div></label>'+ 
			'</div>'
		);
		
		$(e).find('[name=label]').keyup(function(e){
			pt.selectedRoute.label.text = $(e.target).val();
			pt.selectedRoute.showOptions();
			pt.selectedRoute.redrawLabel();
			pt.saveData();
		});
		$(e).find('button').click(function(e){
			var b = $(e.target).closest('button');
			var key = b.attr('name');
			if (!pt.selectedRoute){ return; }
			pt.selectedRoute.label[key] = b.val();
			pt.selectedRoute.showOptions();
			pt.selectedRoute.redraw();
			// serialize data
			pt.saveData();
			e.preventDefault();
			e.stopPropagation();
		});
		e.appendTo(pt.photoEl);
		pt.areaOptionsEl = e;
	}
	e.show();
	e.find('button').removeClass('active');

	e.find('textarea').val(this.label.text);

	// find all values and set
	// set it
	var props =['halign','valign','visible','line','wid'];
	for(var c=0; c<props.length; c++){
		var prop = props[c];
		e.find('button[value='+this.label[prop]+']').addClass('active');
	}

}

Area.prototype.deselect = function(){

	var pt = this.phototopo,
	c;

	if (pt.options.ondeselect){
		pt.options.ondeselect(this);
	}

	pt.selectedRoute = null;
	pt.selectedPoint = null;

	this.redraw();
	
	if (pt.options.editable === true){
		for(c=0; c< this.vertices.length; c++){
			this.vertices[c].circle.attr(pt.styles.handleArea).insertBefore(pt.layerAreas);
			this.vertices[c].setStyle();
		}
	}

	pt.updateHint();
	pt.updateCursor();

	if (pt.areaOptionsEl){
		pt.areaOptionsEl.hide();
	}

};






/*
 * x
 * y
 * offset - insert at the nth position, otherwise add to end
 */
Area.prototype.addVertex = function(x,y,offset,snap){

	if(snap){
		var pos = this.snap(x,y);
		x = pos.x;
		y = pos.y;
	}
	var v = new Vertex(this, x, y);

	// if offset is not specified then add it at the end of th path
	if (offset === undefined || offset === null){
		offset = this.vertices.length;
	}

	// add this vertex into the vertices list
	this.vertices.splice(offset, 0, v);

	// rewire the next and prev links
	if (offset > 0){
		v.prev = this.vertices[offset-1];
	} else {
		v.prev = this.vertices[this.vertices.length-1];
	}

	v.next = v.prev.next;
	v.prev.next = v;
	v.next.prev = v;
	v.redraw();
	v.prev.redraw();

	this.redraw();	
	this.phototopo.saveData();
	if (this.label.x == -1){
		this.moveTo(x,y,true);
	}

	return v;
};


Area.prototype.addAfter = function(afterVert, x, y){
	
	var c;
	for(c=0; c<= this.vertices.length; c++){
		if (this.vertices[c] === afterVert){
			var v = this.addVertex(x,y,c,true);
			v.select();
			return;
		}
	}


};


Area.prototype.onmouseover = Route.prototype.onmouseover;
Area.prototype.onmouseout  = Route.prototype.onmouseout;
Area.prototype.setStyle =    Point.prototype.setStyle;

function Vertex(area, x, y){
	this.area = area;
	this.x = x;
	this.y = y;

	this.next = this;
	this.prev = this; 
}
Vertex.prototype.setStyle = Point.prototype.setStyle;

Vertex.prototype.redraw = function(){

	var area = this.area;
	var e = area.fixPixel;
	this.svg_path = 'M'+e(this.x)+' '+e(this.y)+' L'+e(this.next.x)+' '+e(this.next.y);
	var pt = this.area.phototopo;
	if (this.border){
		this.border.attr( pt.selectedRoute === this.area ? pt.styles.areaBorderSelected : pt.styles.areaBorder );
		var borderStyle = area.label.visible == 'v' ? pt.styles.areaBorderVisible : pt.options.editable ? pt.styles.areaBorderEditHidden : pt.styles.areaBorderHidden;
		this.border.attr(borderStyle);
		this.border.insertBefore(pt.layerShadows);
		this.border.attr('path', this.svg_path);
		if (this.ghost){
			this.ghost.attr('path', this.svg_path);
		}
		return;
	}

	var v = this;
	function clickHandler(e){
		var offset;
		if (!area.phototopo.options.editable){
			area.select();
			if (opts.onclick){
				opts.onclick(this.path.point1.route);
			}
			return;			
		} else {
			offset = $(area.phototopo.photoEl).offset();
			area.addAfter(v.next,
				event.clientX - offset.left + $(window).scrollLeft(),
				event.clientY - offset.top  + $(window).scrollTop()  );
		}
	}

	this.border = pt.canvas.path(this.svg_path);
	this.border.attr(pt.styles.areaBorder).insertBefore(pt.layerAreas);
	this.border.click(clickHandler);

	if (pt.options.editable){
		this.ghost   = pt.canvas.path(this.svg_path).attr(pt.styles.ghost);
		this.ghost.click(clickHandler);
		this.ghost.vert = this;
		this.ghost.mouseover(function(e){
			$(this.vert.area.phototopo.photoEl).addClass('split');
		});
		this.ghost.mouseout(function(e){
			$(this.vert.area.phototopo.photoEl).removeClass('split');
		});
	}

	var circle;
	var styles = pt.styles;

	function dragStart(){
		var selectedRoute = this.point.area.phototopo.selectedRoute;
		$(this.point.area.phototopo.photoEl).addClass('dragging');

		this.ox = this.attr("cx");
		this.oy = this.attr("cy");
			
		// don't allow draging of points if another route is selected
		if (selectedRoute && selectedRoute !== this.point.area){
			return;
		}
		circle.animate(styles.handleHover, 100);
		this.point.select();
	}

	function dragMove(dx, dy){
		var selectedRoute = this.point.area.phototopo.selectedRoute, pos;
		if (selectedRoute && selectedRoute !== this.point.area){
			return;
		}
		pos = circle.point.moveTo(Math.round(this.ox*1 + dx), Math.round(this.oy*1 + dy));
		circle.attr({cx: pos.x, cy: pos.y});
	}

	function dragEnd(){
		var selectedRoute = this.point.area.phototopo.selectedRoute;
		$(this.point.area.phototopo.photoEl).removeClass('dragging');

		if (selectedRoute && selectedRoute !== this.point.area){
			return;
		}
		this.point.setStyle();
	}

	if (pt.options.editable){

		this.circle = pt.canvas.circle(this.x, this.y, 5);
		circle = this.circle;
		circle.point = this;
		circle.attr(styles.handleArea);
		
		circle.drag(dragMove, dragStart, dragEnd); 
		circle.mouseover(function(){

			$(this.point.area.phototopo.photoEl).addClass('point');
			this.point.setStyle();
			this.point.area.onmouseover(this.point);
			this.animate(styles.handleHover, 100);
		});
		circle.mouseout(function(){
			if (!this.point)return;
			$(this.point.area.phototopo.photoEl).removeClass('point');
			this.point.area.onmouseout(this.point);
			this.point.setStyle();
		});
		circle.click(function(e){
			var node = this.point.area.phototopo.selectedRoute;
			// don't allow adding a point in the current route back to itself
			if (this.point.area === node){
				return;
			}
			if (node){
				node.addAfter(this.point.area.phototopo.selectedPoint, this.point.x, this.point.y);
			} else {
				this.point.select();
			}
		});
		circle.dblclick(function(){
			this.point.remove();
		});
		
	}

}
Vertex.prototype.select = function(dontSelectRoute){
	
	var previous = this.area.phototopo.selectedPoint;
	
	if (!dontSelectRoute){
		this.area.select(this);
	}
	if (previous){
		previous.setStyle();
	}
		
	this.setStyle();
};

Vertex.prototype.snap = function(x,y){

	var foundX = null;
	var foundY = null;

	var threshold = 10;

	var myarea = this.area ? this.area : this;
	var pt = myarea.phototopo;

	for(var c in pt.routes){
		var verts = pt.routes[c].vertices;
		if (!verts){ continue; }
		for(var c=0;c<verts.length; c++){
			// if x is within threshold of the vert then lock it in
			if (verts[c] === this){ continue; }
			var tx = verts[c].x;
			var ty = verts[c].y;
			if (!foundX && (tx - threshold < x) && (tx + threshold > x)){ foundX = tx; }
			if (!foundY && (ty - threshold < y) && (ty + threshold > y)){ foundY = ty; }
			if (foundX && foundY){
				return {x:foundX,y:foundY};
			}
		}
	}
	if (!foundX) foundX = x;
	if (!foundY) foundY = y;

	return {x:foundX,y:foundY};
}
Area.prototype.snap =        Vertex.prototype.snap;

Vertex.prototype.moveTo = function(x,y){

	var pos = this.snap(x,y);

	x = pos.x;
	y = pos.y;

	if (this.x === x && this.y === y){
		return { x: x, y: y };
	}
	if (isNaN(x) || isNaN(y) ){
		return { x: this.x, y: this.y };
	}

	this.x = x;
	this.y = y;

	this.area.redraw();

	this.area.phototopo.saveData();

	return { x: this.x, y: this.y };


};

Vertex.prototype.remove = function(){


	// remove all handlers for the point and refs to/from dom
	var area = this.area;
	
	var pos,c;
	for(c=0; c<= area.vertices.length; c++){
		if (area.vertices[c] === this){
			pos = c;
			break;
		}
	}

	// remove handle from raphael
	this.circle.remove();
	// remove point from array
	area.vertices.splice(pos, 1);

	this.next.prev = this.prev;
	this.prev.next = this.next;

	if (this.prev != this){
		this.prev.select();
	}

	this.next = null;
	this.prev = null;


	this.border.remove();
	if (this.ghost){
		this.ghost.remove();
	}
/*
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
*/
	if (this.area.phototopo.selectedPoint === this){
		this.area.phototopo.selectedPoint = null;
	}

	area.redraw();
	area.phototopo.saveData();
	$(area.phototopo.photoEl).removeClass('point');
	area.phototopo.updateCursor();

};


Area.prototype.fixPixel = function(n){
	return n;//+.5;
}





/**
 * A widget for viewing and drawing climbing routes overlaid on a photo
 * @constructor 
 * @param {PhotoTopoOptions} opts The options for this phototopo
 */

function PhotoTopo(opts){

	PhotoTopo.topos.push(this);


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

	this.options = $.extend({}, this.defaultOptions, opts);

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

	/*
	 * These are the layers
	 */
	this.layerShadows = this.canvas.rect(1,1,0,0); // for the area label shadows
	this.layerAreas   = this.canvas.rect(1,1,0,0); // for the area label polygons
	this.layerLabels  = this.canvas.rect(1,1,0,0); // for the text labels




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

	var selectBlue = '#3D80DF';
	var labelColor = '#ffee00';

	this.styles = {
		areaBorder: {
			'stroke': 'black',
			'stroke-width': 4, 
			'stroke-linejoin': 'miter',
			'stroke-linecap': 'round',
		},
		areaBorderSelected: {
			'stroke-width': 4, 
			'stroke': 'white'
		},
		areaBorderVisible: {
			'stroke-dasharray': '',
			'stroke-opacity': 1
		},
		areaBorderHidden: {
			'stroke-opacity': 0
		},
		areaBorderEditHidden: {
			'stroke-dasharray': '..',
			'stroke-opacity': .7
		},
		areaFill: {
			'stroke': labelColor,
			'stroke-width': 2,
			'stroke-linejoin': 'miter',
			'stroke-linecap': 'round',
			'stroke-opacity': 1,
			'fill-opacity': .01,
			'fill': selectBlue
		},
		areaFillSelected: {
			'stroke': selectBlue,
			'fill-opacity': .2
		},
		areaFillVisible: {
			'stroke-opacity': 1
		},
		areaFillHidden: {
			'stroke-opacity': 0
		},
		areaFillEditHidden: {
			'stroke-opacity': .3
		},
		areaLabelText: {
			'fill': 'black',
		},
		areaLabelTextSelected: {
			'fill': 'white'
		},
		areaLabel: {
			'fill': labelColor,
			'stroke': labelColor,
			'stroke-width': 2
		},
		areaLabelSelected: {
			'stroke': selectBlue,
			'fill': selectBlue
		},
		areaLabelShadow: {
			'stroke-width': 4,
			'stroke': 'black'
		},
		areaLabelShadowSelected: {
			'stroke': 'white'
		},
		areaLabelLine: {
			'stroke': labelColor,
			'stroke-width': 2,
			'stroke-linejoin': 'miter',
			'stroke-linecap': 'round'
		},
		areaLabelLineSelected: {
			'stroke-width': 2,
			'stroke': selectBlue,
			'stroke-linejoin': 'miter',
			'stroke-linecap': 'round'
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
			'stroke': selectBlue // default if it can't inherit from label colour
		},
		strokeVisible: {
			'stroke-dasharray': 'none' // If none makes svg bug? if inheret makes another bug where the hidden is 'stuck' after its visible
		},
		strokeHidden: {
			'stroke-dasharray': '.'
		},
		handle: {
			'stroke': 'black', // default if it can't inherit from label colour
			'r': this.options.thickness * 2,
			'fill': 'yellow',
			'stroke-width': this.options.thickness * 0.4
		},
		handleArea: {
			'stroke': 'black', // default if it can't inherit from label colour
			'r': 4,
			'fill': 'yellow',
			'stroke-width': this.options.thickness * 0.4
		},
		handleHover: {
			'fill': 'white'
		},
		handleSelected: {
			'fill': selectBlue,
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
			var area = this.routes[data.id] = new Area(this, data.id, data.order);
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
	'thickness': 1.5,
	'labelSize': 12,
	'autoColors': true,
	'seperateRoutes': true,
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
	} else if (this.selectedRoute.points && this.selectedRoute.points.length === 0){
		this.setHint('Click at the beginning of the route to start drawing this route');
	} else if (this.selectedRoute.vertices && this.selectedRoute.vertices.length === 0){
		this.setHint('Click anywhere to start drawing the area shape');
	} else {
		this.setHint('Click to add or select, then drag to move. Double click to remove');
	}

};

/**
 * @private
 */
PhotoTopo.prototype.setHint = function(hintHTML){
	if (!this.hintEl){
		this.hintEl = $('<div></div>').show('slide').appendTo(this.photoEl)[0];
	}
	this.hintEl.innerHTML = '<strong class="label label-info">Help</strong> '+hintHTML;
	$(this.hintEl).offset(0,0);
};


/**
 * Selects the route with a given id
 * @param {Route} route the route to select
 * @param {Boolean} [toggle] if true and the route is already selected will delesect
 */
PhotoTopo.prototype.selectRoute = function(routeId, toggle){

	// can also be called staticly
	// in this case iterate through all topos and select in them all
	var master = this;
	
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
	return null;
};

/*
 * Same as above but a static class method
 */
PhotoTopo.topos = [];
PhotoTopo.selectRoute = function(nodeId){

	for(var c=0;c<PhotoTopo.topos.length;c++){
		PhotoTopo.topos[c].selectRoute(nodeId);
	}

}


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
	group = this.getNearGroup(point);
		
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

PhotoTopo.prototype.getNearGroup = function(point){

	var threshold = this.options.thickness * 4;
	var key = this.getKey(point);
	var group = this.pointGroups[key];
	if(!group){
		key = this.getKey({x:point.x+threshold,y:point.y});
		group = this.pointGroups[key];
	}
	if(!group){
		key = this.getKey({x:point.x-threshold,y:point.y});
		group = this.pointGroups[key];
	}
	if(!group){
		key = this.getKey({x:point.x,y:point.y+threshold});
		group = this.pointGroups[key];
	}
	if(!group){
		key = this.getKey({x:point.x,y:point.y-threshold});
		group = this.pointGroups[key];
	}
	if(!group){
		key = this.getKey({x:point.x-threshold,y:point.y+threshold});
		group = this.pointGroups[key];
	}
	if(!group){
		key = this.getKey({x:point.x-threshold,y:point.y-threshold});
		group = this.pointGroups[key];
	}
	if(!group){
		key = this.getKey({x:point.x+threshold,y:point.y+threshold});
		group = this.pointGroups[key];
	}
	if(!group){
		key = this.getKey({x:point.x+threshold,y:point.y-threshold});
		group = this.pointGroups[key];
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
	
		if (this.selectedRoute.points && this.selectedRoute.points.length === 0){
			cursor = 'addfirst';
		} else if (this.selectedRoute.vertices && this.selectedRoute.vertices.length === 0){
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
