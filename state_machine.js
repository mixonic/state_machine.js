if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
    "use strict";
    if (this == null) {
      throw new TypeError();
    }
    var t = Object(this);
    var len = t.length >>> 0;
    if (len === 0) {
      return -1;
    }
    var n = 0;
    if (arguments.length > 1) {
      n = Number(arguments[1]);
      if (n != n) { // shortcut for verifying if it's NaN
        n = 0;
      } else if (n != 0 && n != Infinity && n != -Infinity) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
      }
    }
    if (n >= len) {
      return -1;
    }
    var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
    for (; k < len; k++) {
      if (k in t && t[k] === searchElement) {
        return k;
      }
    }
    return -1;
  }
}

if (!Object.create) {
  Object.create = function (o) {
    if (arguments.length > 1) {
      throw new Error('Object.create implementation only accepts the first parameter.');
    }
    function F() {}
    F.prototype = o;
    return new F();
  };
}
if (!Object.keys) {
  Object.keys = (function () {
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
        dontEnums = [
          'toString',
          'toLocaleString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'constructor'
        ],
        dontEnumsLength = dontEnums.length;

    return function (obj) {
      if (typeof obj !== 'object' && typeof obj !== 'function' || obj === null) throw new TypeError('Object.keys called on non-object');

      var result = [];

      for (var prop in obj) {
        if (hasOwnProperty.call(obj, prop)) result.push(prop);
      }

      if (hasDontEnumBug) {
        for (var i=0; i < dontEnumsLength; i++) {
          if (hasOwnProperty.call(obj, dontEnums[i])) result.push(dontEnums[i]);
        }
      }
      return result;
    }
  })()
};

if ( !Array.prototype.forEach ) {
  Array.prototype.forEach = function(fn, scope) {
    for(var i = 0, len = this.length; i < len; ++i) {
      fn.call(scope, this[i], i, this);
    }
  }
}

var a_slice = Array.prototype.slice;
var o_keys = Object.keys;

function makeArray(entry){
  if (entry.constructor === Array) {
    return entry;
  }else if(entry) {
    return [entry];
  }else{
    return [];
  }
}

function StateMachine(options){
  var initialState = options.initialState;
  this.states = options.states;

  if (!this.states) {
    throw new Error('StateMachine needs states');
  }

  this.state  = this.states[initialState];

  if (!this.state) {
    throw new Error('Missing initial state');
  }

  this.currentStateName = initialState;

  this._subscriptions = {};

  var beforeTransitions = (options.beforeTransitions ||[]);
  var afterTransitions  = (options.afterTransitions ||[]);
  var rule;

  for(var i = 0, length = beforeTransitions.length; length > i; i++){
    rule = beforeTransitions[i];
    this.beforeTransition.call(this, rule, rule.fn);
  }

  for(var i = 0, length = afterTransitions.length; length > i; i++){
    rule = afterTransitions[i];
    this.afterTransition.call(this, rule, rule.fn);
  }
}

SM = StateMachine;
StateMachine.SPLAT = SPLAT = '*';

window.StateMachine = StateMachine;


StateMachine.transitionTo = function(state){
  return function(){
    this.transitionTo(state);
  };
};

StateMachine.prototype = {
  states: {},
  toString: function(){
    return "<StateMachine currentState:'" + this.currentStateName +"' >";
  },

  transitionTo: function(nextStateName){
    if (nextStateName.charAt(0) === '.') {
      var splits = this.currentStateName.split('.').slice(0,-1);

      // maybe all states should have an implicit leading dot (kinda like dns)
      if (0 < splits.length){
        nextStateName = splits.join('.') + nextStateName;
      } else {
        nextStateName = nextStateName.substring(1)
      }
    }

    var state = this.states[nextStateName],
    stateName = this.currentStateName;

    if (!state) {
      throw new Error('Unknown State: `' + nextStateName + '`');
    }
    this.willTransition(stateName, nextStateName);

    this.state = state;

    this.currentStateName = nextStateName;
    this.didTransition(stateName, nextStateName);
  },

  beforeTransition: function(options, fn) {
    this._transition('willTransition', options, fn);
  },

  afterTransition: function(options, fn) {
    this._transition('didTransition', options, fn);
  },

  _transition: function(event, filter, fn) {
    var from = filter.from || SPLAT,
      to = filter.to || SPLAT,
      context = this,
      matchingTo, matchingFrom,
      toSplatOffset, fromSplatOffset,
      negatedMatchingTo, negatedMatchingFrom;

    if (to.indexOf('!') === 0) {
      matchingTo = to.substr(1);
      negatedMatchingTo = true;
    } else {
      matchingTo = to;
      negatedMatchingTo = false;
    }

    if (from.indexOf('!') === 0) {
      matchingFrom = from.substr(1);
      negatedMatchingFrom = true;
    } else {
      matchingFrom = from;
      negatedMatchingFrom = false;
    }

    fromSplatOffset = matchingFrom.indexOf(SPLAT);
    toSplatOffset = matchingTo.indexOf(SPLAT);

    if (fromSplatOffset >= 0) {
      matchingFrom = matchingFrom.substring(fromSplatOffset, 0);
    }

    if (toSplatOffset >= 0) {
      matchingTo = matchingTo.substring(toSplatOffset, 0);
    }

    this.on(event, function(currentFrom, currentTo) {
      var currentMatcherTo = currentTo,
        currentMatcherFrom = currentFrom,
        toMatches, fromMatches;

      if (fromSplatOffset >= 0){
        currentMatcherFrom = currentFrom.substring(fromSplatOffset, 0);
      }

      if (toSplatOffset >= 0){
        currentMatcherTo = currentTo.substring(toSplatOffset, 0);
      }

      toMatches = (currentMatcherTo === matchingTo) !== negatedMatchingTo;
      fromMatches = (currentMatcherFrom === matchingFrom) !== negatedMatchingFrom;

      if (toMatches && fromMatches) {
        fn.call(this, currentFrom, currentTo);
      }
    });
  },

  willTransition: function(from, to) {
    this._notify('willTransition', from, to);
  },

  didTransition: function(from, to) {
    this._notify('didTransition', from, to);
  },

  _notify: function(name, from, to) {
    var subscriptions = (this._subscriptions[name] || []);

    for( var i = 0, length = subscriptions.length; i < length; i++){
      subscriptions[i].call(this, from, to);
    }
  },

  on: function(event, fn) {
    this._subscriptions[event] = this._subscriptions[event] || [];
    this._subscriptions[event].push(fn);
  },

  off: function(event, fn) {
    var idx = this._subscriptions[event].indexOf(fn);

    if (fn){
      if (idx) {
        this._subscriptions[event].splice(idx, 1);
      }
    }else {
      this._subscriptions[event] = null;
    }
  },

  send: function(eventName) {
    var event = this.state[eventName];
    args = a_slice.call(arguments, 1);

    if (event) {
      return event.apply(this, args);
    } else {
      this.unhandledEvent(eventName);
    }
  },

  trySend: function(eventName) {
    var event = this.state[eventName];
    args = a_slice.call(arguments,1);

    if (event) {
      return event.apply(this, args);
    }
  },

  event: function(eventName, callback){
    var states = this.states;

    var eventApi = {
      transition: function() {
        var length = arguments.length,
        first = arguments[0],
        second = arguments[1],
        events = normalizeEvents(eventName, first, second);

        o_keys(events).forEach(function(from){
          var to = events[from];
          compileEvent(states, eventName, from, to, SM.transitionTo(to));
        });
      }
    };

    callback.call(eventApi);
  },

  unhandledEvent: function(event){
    var currentStateName = this.currentStateName,
    message = "Unknown Event: `" + event + "` for: " + this.toString();

    throw new Error(message);
  }
};

function normalizeEvents(eventName, first, second){
  var events;
  if (!first) { throw new Error('invalid Transition'); }

  if (second) {
    var froms = first, to = second;
    events = expandArrayEvents(froms, to);
  } else {
    if (first.constructor === Object) {
      events = first;
    } else {
      throw new Error('something went wrong');
    }
  }

  return events;
}

function expandArrayEvents(froms, to){
  return  makeArray(froms).reduce(function(events, from){
     events[from] = to;
     return events;
   }, {});
}

function compileEvent(states, eventName, from, to, fn){
  var state = states[from];

  if (from && to && state) {
    states[from][eventName] = fn;
  } else {
    var message = "invalid transition state: " + (state && state.currentStateName) + " from: " + from+ " to: " + to ;
    throw new Error(message);
  }
}
