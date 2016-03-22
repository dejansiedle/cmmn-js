'use strict';

var inherits = require('inherits'),
    isArray = require('lodash/lang/isArray'),
    isObject = require('lodash/lang/isObject'),
    assign = require('lodash/object/assign');

var BaseRenderer = require('diagram-js/lib/draw/BaseRenderer'),
    TextUtil = require('diagram-js/lib/util/Text'),
    DiUtil = require('../util/DiUtil'),
    LabelUtil = require('../util/LabelUtil'),
    ModelUtil = require('../util/ModelUtil');

var getLabelBounds = LabelUtil.getLabelBounds;

var isStandardEventVisible = DiUtil.isStandardEventVisible;
var isPlanningTableCollapsed = DiUtil.isPlanningTableCollapsed;

var isCasePlanModel = ModelUtil.isCasePlanModel;
var getBusinessObject = ModelUtil.getBusinessObject;
var getDefinition = ModelUtil.getDefinition;
var isRequired = ModelUtil.isRequired;
var isRepeatable = ModelUtil.isRepeatable;
var isManualActivation = ModelUtil.isManualActivation;
var isAutoComplete = ModelUtil.isAutoComplete;
var hasPlanningTable = ModelUtil.hasPlanningTable;
var getName = ModelUtil.getName;
var is = ModelUtil.is;

function CmmnRenderer(eventBus, styles, pathMap) {

  BaseRenderer.call(this, eventBus);

  var TASK_BORDER_RADIUS = 10;
  var MILESTONE_BORDER_RADIUS = 24;
  var STAGE_EDGE_OFFSET = 20;

  var LABEL_STYLE = {
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px'
  };

  var textUtil = new TextUtil({
    style: LABEL_STYLE,
    size: { width: 100 }
  });

  // draw shape //////////////////////////////////////////////////////////////

  function computeStyle(custom, traits, defaultStyles) {
    if (!isArray(traits)) {
      defaultStyles = traits;
      traits = [];
    }

    return styles.style(traits || [], assign(defaultStyles, custom || {}));
  }

  function drawCircle(p, width, height, offset, attrs) {

    if (isObject(offset)) {
      attrs = offset;
      offset = 0;
    }

    offset = offset || 0;

    attrs = computeStyle(attrs, {
      stroke: 'black',
      strokeWidth: 2,
      fill: 'white'
    });

    var cx = width / 2,
        cy = height / 2;

    return p.circle(cx, cy, Math.round((width + height) / 4 - offset)).attr(attrs);
  }

  function drawRect(p, width, height, r, offset, attrs) {

    if (isObject(offset)) {
      attrs = offset;
      offset = 0;
    }

    offset = offset || 0;

    attrs = computeStyle(attrs, {
      stroke: 'black',
      strokeWidth: 2,
      fill: 'white'
    });

    return p.rect(offset, offset, width - offset * 2, height - offset * 2, r).attr(attrs);
  }

  function drawDiamond(p, width, height, attrs) {

    var x_2 = width / 2;
    var y_2 = height / 2;

    var points = [x_2, 0, width, y_2, x_2, height, 0, y_2 ];

    attrs = computeStyle(attrs, {
      stroke: 'black',
      strokeWidth: 2,
      fill: 'white'
    });

    return p.polygon(points).attr(attrs);
  }

  function drawPath(p, d, attrs) {

    attrs = computeStyle(attrs, [ 'no-fill' ], {
      strokeWidth: 2,
      stroke: 'black'
    });

    return p.path(d).attr(attrs);
  }

  function drawOctagon(p, width, height, offset, attrs) {
    offset = offset || 20;

    var x1 = offset;
    var y1 = height;

    var x2 = 0;
    var y2 = height - offset;

    var x3 = 0;
    var y3 = offset;

    var x4 = offset;
    var y4 = 0;

    var x5 = width - offset;
    var y5 = 0;

    var x6 = width;
    var y6 = offset;

    var x7 = width;
    var y7 = height - offset;

    var x8 = width - offset;
    var y8 = height;

    var points = [ x1, y1, x2, y2, x3, y3, x4, y4, x5, y5, x6, y6, x7, y7, x8, y8 ];

    attrs = attrs || {};
    attrs.fill = 'white';
    attrs.stroke = 'black';
    attrs.strokeWidth = 2;

    return drawPolygon(p, points, attrs);
  }

  function drawPolygon(p, points, attrs) {
    return p.polygon(points).attr(attrs);
  }

  // draw connection ////////////////////////////////////////////

  function createPathFromConnection(connection) {
    var waypoints = connection.waypoints;

    var pathData = 'm  ' + waypoints[0].x + ',' + waypoints[0].y;
    for (var i = 1; i < waypoints.length; i++) {
      pathData += 'L' + waypoints[i].x + ',' + waypoints[i].y + ' ';
    }
    return pathData;
  }

  // render label //////////////////////////////////////////////

  function renderLabel(p, label, options) {
    return textUtil.createText(p, label || '', options).addClass('djs-label');
  }

  function renderEmbeddedLabel(p, element, align) {
    var name = getName(element);
    return renderLabel(p, name, { box: element, align: align, padding: 5 });
  }

  function renderExpandedStageLabel(p, element, align) {
    var name = getName(element);
    var textbox = renderLabel(p, name, { box: element, align: align, padding: 5 });

    // reset the position of the text box
    textbox.transform(
      'translate(' + STAGE_EDGE_OFFSET + ',' + 0 + ')'
    );

    return textbox;
  }

  function renderCasePlanModelLabel(p, element) {
    var bo = getBusinessObject(element);

    // default
    var height = 16;
    var width = 120;
    var padding = 4;

    var labelBounds = getLabelBounds(bo);
    if (labelBounds) {
      height = parseFloat(labelBounds.height, 10) + padding;
      width = parseFloat(labelBounds.width, 10);
    }

    // draw polygon
    var points = [ 10,0, 20,(height*-1), width,(height*-1), (width + 10),0];
    drawPolygon(p, points, {
      fill: 'white',
      stroke: 'black',
      strokeWidth: 2
    });

    // get label
    var label = bo.name;

    // create text box
    var textBox = renderLabel(p, label, {
      box: { height: height, width: width },
      align: 'left-top'
    });

    // reset the position of the text box
    textBox.transform(
      'translate(' + 20 + ',' + (height * -1) + ')'
    );

    return textBox;
  }

  function renderExternalLabel(p, element, align) {
    var name = getName(element);

    if (isStandardEventVisible(element) && getBusinessObject(element).standardEvent) {
      var standardEvent = '[' + getBusinessObject(element).standardEvent + ']';
      if (name) {
        name = name + ' ' + standardEvent;
      }
      else {
        name = standardEvent;
      }
    }

    if (!name) {
      element.hidden = true;
    }

    return renderLabel(p, name, { box: element, align: align, style: { fontSize: '11px' } });
  }

  // render elements //////////////////////////////////////////

  function renderer(type) {
    return handlers[type];
  }

  var handlers = {
    'cmmn:PlanItem': function(p, element) {
      var definition = getDefinition(element);
      return renderer(definition.$type)(p, element);
    },

    'cmmn:DiscretionaryItem': function (p, element) {
      var definition = getDefinition(element);
      return renderer(definition.$type)(p, element, {
        strokeDasharray: '10, 12'
      });
    },

    // STAGE
    'cmmn:Stage': function(p, element, attrs) {
      var rect;
      if (isCasePlanModel(element)) {
        return handlers['cmmn:CasePlanModel'](p, element);
      }

      rect = drawOctagon(p, element.width, element.height, STAGE_EDGE_OFFSET, attrs);
      var isCollapsed = element.collapsed;

      if (!isCollapsed) {
        renderExpandedStageLabel(p, element, 'left-top');
      }
      else {
        renderEmbeddedLabel(p, element, 'center-middle');
      }

      attachPlanningTableMarker(p, element);
      attachStageMarkers(p, element);
      return rect;
    },

    // STAGE
    'cmmn:PlanFragment': function(p, element, attrs) {
      var rect = drawRect(p, element.width, element.height, TASK_BORDER_RADIUS, {
        strokeDasharray: '10, 12'
      });

      var isCollapsed = element.collapsed;
      renderEmbeddedLabel(p, element, isCollapsed ? 'center-middle' : 'left-top');

      attachStageMarkers(p, element);
      return rect;
    },

    'cmmn:CasePlanModel': function (p, element) {
      var rect = drawRect(p, element.width, element.height);
      renderCasePlanModelLabel(p, element);
      attachPlanningTableMarker(p, element);
      attachCasePlanModelMarkers(p, element);
      return rect;
    },

    // MILESTONE
    'cmmn:Milestone': function(p, element, attrs) {
      var rect = drawRect(p, element.width, element.height, MILESTONE_BORDER_RADIUS, attrs);
      renderEmbeddedLabel(p, element, 'center-middle');
      return rect;
    },

    // EVENT LISTENER
    'cmmn:EventListener': function(p, element, attrs) {
      var outerCircle = drawCircle(p, element.width, element.height,  attrs);

      attrs = attrs || {};
      attrs.strokeWidth = 2;

      drawCircle(p, element.width, element.height, 0.1 * element.height, attrs);
      return outerCircle;
    },

    'cmmn:TimerEventListener': function(p, element, attrs) {
      var circle = renderer('cmmn:EventListener')(p, element, attrs);

      var pathData = pathMap.getScaledPath('EVENT_TIMER_WH', {
        xScaleFactor: 0.75,
        yScaleFactor: 0.75,
        containerWidth: element.width,
        containerHeight: element.height,
        position: {
          mx: 0.5,
          my: 0.5
        }
      });

      drawPath(p, pathData, {
        strokeWidth: 2,
        strokeLinecap: 'square'
      });

      for(var i = 0;i < 12;i++) {

        var linePathData = pathMap.getScaledPath('EVENT_TIMER_LINE', {
          xScaleFactor: 0.75,
          yScaleFactor: 0.75,
          containerWidth: element.width,
          containerHeight: element.height,
          position: {
            mx: 0.5,
            my: 0.5
          }
        });

        var width = element.width / 2;
        var height = element.height / 2;

        drawPath(p, linePathData, {
          strokeWidth: 1,
          strokeLinecap: 'square',
          transform: 'rotate(' + (i * 30) + ',' + height + ',' + width + ')'
        });
      }


      return circle;
    },

    'cmmn:UserEventListener': function(p, element, attrs) {
      var circle = renderer('cmmn:EventListener')(p, element, attrs);

        // TODO: The user event decorator has to be
        // scaled correctly!
        var x = 20;
        var y = 15;

        var pathData = pathMap.getScaledPath('TASK_TYPE_USER_1', {
          abspos: {
            x: x,
            y: y
          }
        });

        /* user path */ drawPath(p, pathData, {
          strokeWidth: 0.5,
          fill: 'none'
        });

        var pathData2 = pathMap.getScaledPath('TASK_TYPE_USER_2', {
          abspos: {
            x: x,
            y: y
          }
        });

        /* user2 path */ drawPath(p, pathData2, {
          strokeWidth: 0.5,
          fill: 'none'
        });

        var pathData3 = pathMap.getScaledPath('TASK_TYPE_USER_3', {
          abspos: {
            x: x,
            y: y
          }
        });

        /* user3 path */ drawPath(p, pathData3, {
          strokeWidth: 0.5,
          fill: 'black'
        });

      return circle;
    },

    // TASK
    'cmmn:Task': function(p, element, attrs) {
      var rect = drawRect(p, element.width, element.height, TASK_BORDER_RADIUS, attrs);
      renderEmbeddedLabel(p, element, 'center-middle');
      attachTaskMarkers(p, element);
      return rect;
    },

    'cmmn:HumanTask': function(p, element, attrs) {
      var task = renderer('cmmn:Task')(p, element, attrs);

      var bo = element.businessObject;
      var definition = bo.definitionRef;

      if (definition.isBlocking) {
        var x = 15;
        var y = 12;

        var pathData1 = pathMap.getScaledPath('TASK_TYPE_USER_1', {
          abspos: {
            x: x,
            y: y
          }
        });

        /* user path */ drawPath(p, pathData1, {
          strokeWidth: 0.5,
          fill: 'none'
        });

        var pathData2 = pathMap.getScaledPath('TASK_TYPE_USER_2', {
          abspos: {
            x: x,
            y: y
          }
        });

        /* user2 path */ drawPath(p, pathData2, {
          strokeWidth: 0.5,
          fill: 'none'
        });

        var pathData3 = pathMap.getScaledPath('TASK_TYPE_USER_3', {
          abspos: {
            x: x,
            y: y
          }
        });

        /* user3 path */ drawPath(p, pathData3, {
          strokeWidth: 0.5,
          fill: 'black'
        });
      }

      else {
        var pathData = pathMap.getScaledPath('TASK_TYPE_MANUAL', {
          abspos: {
            x: 17,
            y: 15
          }
        });

        /* manual path */ drawPath(p, pathData, {
          strokeWidth: 1.25,
          fill: 'white',
          stroke: 'black'
        });
      }

      attachPlanningTableMarker(p, element);

      return task;
    },

    'cmmn:CaseTask': function(p, element, attrs) {
      var task = renderer('cmmn:Task')(p, element, attrs);

      var pathData = pathMap.getScaledPath('TASK_TYPE_FOLDER', {
        abspos: {
          x: 7,
          y: 7
        }
      });

      /* manual path */ drawPath(p, pathData, {
        strokeWidth: 1.25,
        fill: 'white',
        stroke: 'black'
      });

      return task;
    },

    'cmmn:ProcessTask': function(p, element, attrs) {
      var task = renderer('cmmn:Task')(p, element, attrs);

      var pathData = pathMap.getScaledPath('TASK_TYPE_CHEVRON', {
        abspos: {
          x: 5,
          y: 5
        }
      });

      /* manual path */ drawPath(p, pathData, {
        strokeWidth: 1.25,
        fill: 'white',
        stroke: 'black'
      });

      return task;
    },

    'cmmn:DecisionTask': function(p, element, attrs) {
      var task = renderer('cmmn:Task')(p, element, attrs);

      var headerPathData = pathMap.getScaledPath('TASK_TYPE_BUSINESS_RULE_HEADER', {
        abspos: {
          x: 8,
          y: 8
        }
      });

      var businessHeaderPath = drawPath(p, headerPathData);
      businessHeaderPath.attr({
        strokeWidth: 1,
        fill: 'AAA'
      });

      var headerData = pathMap.getScaledPath('TASK_TYPE_BUSINESS_RULE_MAIN', {
        abspos: {
          x: 8,
          y: 8
        }
      });

      var businessPath = drawPath(p, headerData);
      businessPath.attr({
        strokeWidth: 1
      });

      return task;
    },

    'cmmn:CaseFileItem': function(p, element, attrs) {
      var pathData = pathMap.getScaledPath('DATA_OBJECT_PATH', {
        xScaleFactor: 1,
        yScaleFactor: 1,
        containerWidth: element.width,
        containerHeight: element.height,
        position: {
          mx: 0.474,
          my: 0.296
        }
      });

      return drawPath(p, pathData, { fill: 'white' });
    },

    // MARKERS
    'StageMarker': function(p, element) {
      var markerRect = drawRect(p, 14, 14, 0, {
        strokeWidth: 1,
        stroke: 'black'
      });

      markerRect.transform('translate(' + (element.width / 2 - 7) + ',' + (element.height - 17) + ')');

      var path = element.collapsed ? 'MARKER_STAGE_COLLAPSED' : 'MARKER_STAGE_EXPANDED';

      var stagePath = pathMap.getScaledPath(path, {
        xScaleFactor: 1.5,
        yScaleFactor: 1.5,
        containerWidth: element.width,
        containerHeight: element.height,
        position: {
          mx: (element.width / 2 - 7) / element.width,
          my: (element.height - 17) / element.height
        }
      });

      drawPath(p, stagePath);
    },

    'RequiredMarker': function(p, element, position) {
      var path = pathMap.getScaledPath('MARKER_REQUIRED', {
        xScaleFactor: 1,
        yScaleFactor: 1,
        containerWidth: element.width,
        containerHeight: element.height,
        position: {
          mx: ((element.width / 2 + position) / element.width),
          my: (element.height - 18) / element.height
        }
      });

      drawPath(p, path);
    },

    'AutoCompleteMarker': function(p, element, position) {
      var markerRect = drawRect(p, 14, 14, 0, {
        strokeWidth: 1,
        stroke: 'black',
        fill: 'black'
      });
      markerRect.transform('translate(' + (element.width / 2 + position) + ',' + (element.height - 17) + ')');
    },

    'ManualActivationMarker': function(p, element, position) {
      var path = pathMap.getScaledPath('MARKER_MANUAL_ACTIVATION', {
        xScaleFactor: 1,
        yScaleFactor: 1,
        containerWidth: element.width,
        containerHeight: element.height,
        position: {
          mx: ((element.width / 2 + position) / element.width),
          my: (element.height - 18) / element.height
        }
      });

      drawPath(p, path);
    },

    'RepetitionMarker': function(p, element, position) {
      var path = pathMap.getScaledPath('MARKER_REPEATABLE', {
        xScaleFactor: 1,
        yScaleFactor: 1,
        containerWidth: element.width,
        containerHeight: element.height,
        position: {
          mx: ((element.width / 2 + position) / element.width),
          my: (element.height - 18) / element.height
        }
      });

      drawPath(p, path);
    },

    'PlanningTableMarker': function(p, element, position) {
      var planningTableRect = drawRect(p, 30, 24, 0, {
        strokeWidth: 1.5,
        stroke: 'black'
      });

      planningTableRect.transform('translate(' + (element.width / 2 - 15) + ',' + (- 17) + ')');

      var isCollapsed = isPlanningTableCollapsed(element);

      var marker = isCollapsed ? 'MARKER_PLANNING_TABLE_COLLAPSED' : 'MARKER_PLANNING_TABLE_EXPANDED';

      var stagePath = pathMap.getScaledPath(marker, {
        xScaleFactor: 1.5,
        yScaleFactor: 1.5,
        containerWidth: element.width,
        containerHeight: element.height,
        position: {
          mx: (element.width / 2 - 15) / element.width,
          my: (-17) / element.height
        }
      });

      drawPath(p, stagePath, {
        strokeWidth: 1.5
      });
    },

    'cmmn:OnPart': function(p, element) {
      var pathData = createPathFromConnection(element);

      var path = drawPath(p, pathData, {
        strokeDasharray: '3, 5',
        strokeWidth: 1,
      });

      return path;
    },
    'cmmn:PlanItemOnPart': function(p, element) {
      return renderer('cmmn:OnPart')(p, element);
    },
    'cmmn:CaseFileItemOnPart': function(p, element) {
      return renderer('cmmn:OnPart')(p, element);
    },
    'cmmn:EntryCriterion': function(p, element) {
      return drawDiamond(p, element.width, element.height, {
        fill: 'white'
      });
    },
    'cmmn:ExitCriterion': function(p, element) {
      return drawDiamond(p, element.width, element.height, {
        fill: 'black'
      });
    },

    'cmmndi:CMMNEdge': function(p, element) {
      var pathData = createPathFromConnection(element);

      var path = drawPath(p, pathData, {
        strokeDasharray: '3, 5',
        strokeWidth: 1,
      });

      return path;
    },

    'label': function(p, element) {
      return renderExternalLabel(p, element, '');
    }
  };

  // attach markers /////////////////////////

  function attachTaskMarkers(p, element) {
    var obj = getBusinessObject(element);
    var padding = 6;

    var markers = [];

    if (isRequired(obj)) {
      markers.push({ marker: 'RequiredMarker', width: 1 });
    }

    if (isManualActivation(obj)) {
      markers.push({ marker: 'ManualActivationMarker', width: 14 });
    }

    if (isRepeatable(obj)) {
      markers.push({ marker: 'RepetitionMarker', width: 14 });
    }

    if (markers.length) {

      if (markers.length === 1) {
        // align marker in the middle of the element
        drawMarker(markers[0].marker, p, element, (markers[0].width / 2) * (-1));
      }

      else if (markers.length === 2) {
        /* align marker:
         *
         *      |             |
         *      +-------------+
         *             ^
         *             |
         *         +-+   +-+
         *         |0|   |1| <-- markers
         *         +-+   +-+
         * (leftMarker)  (rightMarker)
         */
        drawMarker(markers[0].marker, p, element, (markers[0].width * (-1)) - (padding /2));
        drawMarker(markers[1].marker, p, element, padding / 2);
      }

      else if (markers.length === 3) {
        /* align marker:
         *
         *      |             |
         *      +-------------+
         *             ^
         *             |
         *      +-+   +-+   +-+
         *      |0|   |1|   |2| <-- markers
         *      +-+   +-+   +-+
         */

        /* 1 */ drawMarker(markers[1].marker, p, element, markers[1].width / 2 * (-1));
        /* 0 */ drawMarker(markers[0].marker, p, element, (markers[1].width / 2 * (-1)) - padding - markers[0].width);
        /* 2 */ drawMarker(markers[2].marker, p, element, (markers[1].width / 2) + padding);
      }
    }
  }

  function attachCasePlanModelMarkers(p, element) {
    var obj = getBusinessObject(element);

    if (isAutoComplete(obj)) {
      drawMarker('AutoCompleteMarker', p, element, -7);
    }
  }

  function attachStageMarkers(p, element, stage) {
    var obj = getBusinessObject(element);
    var padding = 6;

    drawMarker('StageMarker', p, element, -7);

    var leftMarkers = [];

    if (isRequired(obj)) {
      leftMarkers.push({marker: 'RequiredMarker', width: 1 });
    }

    if (isAutoComplete(obj)) {
      leftMarkers.push({marker: 'AutoCompleteMarker', width: 14 });
    }

    if (leftMarkers.length) {

      if (leftMarkers.length === 1) {
        drawMarker(leftMarkers[0].marker, p, element, (leftMarkers[0].width * (-1) - 7 - padding));
      }

      else if (leftMarkers.length === 2) {
        drawMarker(
          leftMarkers[0].marker,
          p,
          element,
          ((leftMarkers[1].width * (-1)) - 7 - padding) - (leftMarkers[0].width * (-1)) - padding
        );

        drawMarker(leftMarkers[1].marker, p, element, (leftMarkers[1].width * (-1)) - 7 - padding);
      }

    }

    var rightMarkers = [];

    if (isManualActivation(obj)) {
      rightMarkers.push({marker: 'ManualActivationMarker', width: 14});
    }

    if (isRepeatable(obj)) {
      rightMarkers.push({marker: 'RepetitionMarker', width: 14 });
    }

    if (rightMarkers.length) {

      if (rightMarkers.length === 1) {
        drawMarker(rightMarkers[0].marker, p, element, 7 + padding);
      }

      else if (rightMarkers.length === 2) {
        drawMarker(rightMarkers[0].marker, p, element, 7 + padding);
        drawMarker(rightMarkers[1].marker, p, element, 7 + padding + rightMarkers[0].width + padding);
      }

    }
  }

  function attachPlanningTableMarker(p, element) {
    if (hasPlanningTable(element)) {
      drawMarker('PlanningTableMarker', p, element);
    }
  }

  function drawMarker(marker, parent, element, position) {
    renderer(marker)(parent, element, position);
  }

  // draw shape and connection ////////////////////////////////////

  function drawShape(parent, element) {
    var h = handlers[element.type];

    /* jshint -W040 */
    if (!h) {
      return BaseRenderer.prototype.drawShape.apply(this, [ parent, element ]);
    } else {
      return h(parent, element);
    }
  }

  function drawConnection(parent, element) {
    var type = element.type;
    var h = handlers[type];

    /* jshint -W040 */
    if (!h) {
      return BaseRenderer.prototype.drawConnection.apply(this, [ parent, element ]);
    } else {
      return h(parent, element);
    }
  }

  this.canRender = function(element) {
    return is(element, 'cmmn:CMMNElement') || is(element, 'cmmndi:CMMNEdge');
  };

  this.drawShape = drawShape;
  this.drawConnection = drawConnection;
}

inherits(CmmnRenderer, BaseRenderer);

CmmnRenderer.$inject = [ 'eventBus', 'styles', 'pathMap' ];

module.exports = CmmnRenderer;