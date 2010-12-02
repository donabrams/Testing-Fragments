/*
 * jquery.udel.stateWidget.js
 * Adds the following to the jquery namespace:
 *   $.condWait(max_attempts/int, delay/int, condFunc/function()->boolean, condScope/{}, func/function(), scope/{}, arguments/{} ):
 *		asynchronous.  calls confFunc with scope condScope.  If true, call func(arguments) with scope scope.  
 *		Otherwise, increments attemps and if past max_attempts, fails.  Otherwise, waits delay.
 *   $.udel.template({url:"",templateString:"", template:{})}
 * 		methods: 
 *			applyTemplate(data/{}, target/DOMNode, callback/function(), keepPreviousTemplate/boolean): asynchronous. Applies data 
 * 				to template and sets it on target, then calls callback.
 *   $.udel.store(args/{url: "", method: "POST" or "GET", data: {}, preformatter: function(obj)->{}, postformatter: function(obj)->{}})
 *      methods: 
 *			fetch(action/"", callback/function(data/{}), data/{}): asynchronous. applies preformatter on data, sends it to url, 
 *				then applies postformatter and calls callback on that data.  If no url: if action is "save", 
 *				overwrites data with data then returns data (even if action is not save).
 *   $.udel.state(args/{templateName: "",actions: {<key : <"" or function()->"">>*}, init: function(widget/{}){}, keepPreviousTemplate: bool})
 * 		optional members: 
 *			keepPreviousTemplate/boolean: if state overwrites previous template when moved to state
 *			templateName/"": template name that should be rendered on move to state
 *			actions/{<key:function(widget/{},dataIn/{})->"">*}: map of possible actions.  Actions are functions that return the name of the state 
 * 				that should be transitioned to.
 *      optional methods:
 *			init(widget/{}): function that should be called after template renders
 *   $.fn.factory(args/{name:""})
 * 		methods: 
 *			_getInstance("")->{}: return current widget type with given name
 *			_getInstanceMap()->{<name: widget>*}: returns mapping of all current widget types		
 *   $.fn.stateWidget(args/{name: "", 
 *			stores: {<key : <"" if url or $.udel.store args {}>>*}, 
 *			templateBaseUrl: "", 
 *			templates: {<'templateRefName' : <"" if url or $.udel.template args>>*},
 *			states: {<'stateRefName' : <"" if url or $.udel.state args>>*},
 *			initialData: {}})
 * 		methods: 
 *			getData(): get (local) data from widget
 *			saveData({}): save (local) data to widget
 *			loadDataFromStore(args/{}, callback/function(data/{}), storeAction/"", storeName/""): asynchronous. load data from remote or local store. 
 *				If args is a function, assumed to be callback and args are null.
 *			saveDataToStore(args/{}, callback/function(result/{}), storeAction/"", storeName/""): asynchronous. save data to remote or local store.
 *				If args is a function, assumed to be callback and args are null (storeAction and Name also appropriately moved).
 *			doAction(action, dataIn)-><"">: calls the named action if it exists and transitions to the named state returned not if not null.
 */
(function($) {
    $.condWait = function(max_attempts, delay, condFunc, condScope, func, scope /*, arguments */ ) {
        var worker = function(attempts, max_attempts, delay, flagFunc, flagScope, func, scope, args) {
            if (attempts >= max_attempts) {
                return false;
            }
            if (!flagFunc.apply(flagScope || window, [])) {
                //increment attempts
                var args2 = [attempts + 1].concat(Array.prototype.slice.call(arguments, 1));
				var toApply = function() {
            		worker.apply(this || window, args2 || []);
				};
				setTimeout(toApply, delay);
            }
            else {
                //apply just the arguments!
                func.apply(scope, args);
            }
        };
        worker(0, max_attempts, delay, condFunc, condScope, func, scope, Array.prototype.slice.call(arguments, 6));
    };
    $.udel = $.udel || {};
    $.udel.template = function(args) {
/*
    args: {
        //any (1) of the following:
        url: null,
        templateString: "",
        template: null
    }*/
        this.ready = false;
        if (args.template) {
            this.template = args.template;
            this.ready = true;
        }
        else if (args.templateString) {
            this.template = $.template(args.templateString);
            this.ready = true;
        }
        else if (args.url) {
            var that = this;
            $.ajax({
                dataType: "text",
                url: args.url,
                type: "GET",
                success: function(tmplString) {
//	$("#templatePre").html(tmplString);
//	alert(tmplString);
                    that.template = $.template(tmplString);
                    that.ready = true;
                },
                error: function() {
                    that.template = "Error loading template.";
                }
            });
        }
        this.applyTemplate = function(data, target, callback, keepPreviousTemplate) {
			//console.log("template data to apply:");
			//console.log(data);
            var that = this;
            //wait 4 seconds for the template if its not loaded yet
            //TODO: add this to config!
            $.condWait(20, 200, function() {
                return that.ready;
            }, that, function() {
                that._applyTemplate(data, target, keepPreviousTemplate);
                if (callback) {
                    callback();
                }
            }, that);
        };
        this._applyTemplate = function(data, target, keepPreviousTemplate) {
            if (!target) {
                target = data;
                data = null;
            }
            if (this.template) {
                if (!keepPreviousTemplate) {
                    target.html("");
                }
                $.tmpl(this.template, data).appendTo(target);
            }
        };
    };
    $.udel.store = function(args) {
/*
    args: {
        url: null,
        method: "POST",//or "GET"
        data: {},
        preformatter: null,
        postformatter: null
    }*/
        this.url = args.url;
        this.data = args.data;
        this.method = args.method ? args.method : "POST";
        this.preformatter = args.preformatter;
        this.postformatter = args.postformatter ? args.postformatter : function(data) { return $.parseJSON(data)};

        this.fetch = function(action, callback, data) {
            var that = this;
            var dataReceiver = function(data) {
                if (callback) {
                    if (that.postformatter) {
                        data = that.postformatter(data);
                    }
                    callback(data);
                }
            };
            if (this.preformatter) {
                data = this.preformatter(data);
            }
            if (this.url) {			
                $.ajax({
                    'data': data,
                    url: that.url + (action ? action : ""),
                    type: that.method,
                    success: function(responseData) {
						//console.log("responseData");
						//console.log(responseData);
                        dataReceiver(responseData);
                    }
                    //TODO: error
                });
            }
            else {
                dataReceiver(data);
            }
        };
    };
    $.udel.state = function(args) {
/*
    args: {
        templateName: template name,
        //Inside actions, this === a stateWidget instance
        actions: [string or function to do something and return a string]
        init: function,
        keepPreviousTemplate: boolean
    }*/
        this.keepPreviousTemplate = args.keepPreviousTemplate ? true : false;
        this.init = args.init;
        this.templateName = args.templateName;
        this.actions = {};
        var that = this;
        if (args.actions) {
            //convert all actions to functions
            $.each(args.actions, function(i) {
                var func = args.actions[i];
                if (!$.isFunction(func)) {
                    var s = func;
                    func = function() {
                        return s;
                    };
                }
                that.actions[i] = func;
            });
        }
    };
    //When extended, name must be provided
    $.widget("udel.factory", {
        options: {
            name: "factoryDefault"
        },
        // If create is overridden, call _registerInstance() unless you don't want it added!
        _create: function() {
            this._registerInstance();
        },
        _registerInstance: function() {
            var pkg = this._getWidgetPackage();
            if (!pkg.instanceMap) {
                pkg.instanceMap = {};
            }
            pkg.instanceMap[this.options.name] = this.element;
        },
        destroy: function() {
            var map = this._getInstanceMap();
            if (map && map[this.options.name]) {
                map.remove(this.options.name);
            }
            $.Widget.prototype.destroy.apply(this || window, arguments || []);
        },
        _getWidgetPackage: function() {
            return $[this.namespace][this.widgetName];
        },
        _getInstanceMap: function() {
            return this._getWidgetPackage().instanceMap;
        },
        _getInstance: function(name) {
            return this._getInstanceMap()[name];
        }
    });
    //TODO: replace flags with events???
    $.widget("udel.stateWidget", $.udel.factory, {
        options: {
            name: "genericStateWidget",
            stores: {},
            templateBaseUrl: null,
            templates: {},
            states: {},
            initialData: null
        },
        getData: function(dataIn) {
            var data = {};
            $.extend(true, data, this.data, dataIn);
            return data;
        },
        saveData: function(data) {
            this.data = data;
        },
        loadDataFromStore: function(args, callback, storeAction, storeName) {
			if ($.isFunction(args)) {
				storeName = storeAction;
				storeAction = callback;
				callback = args;
				args = null;
			}
            this._fetchFromStore(args, storeAction ? storeAction : "get", callback, storeName);
        },
        saveDataToStore: function(args, callback, storeAction, storeName) {
			if ($.isFunction(args)) {
				storeName = storeAction;
				storeAction = callback;
				callback = args;
				args = null;
			}
            this._fetchFromStore(args, storeAction ? storeAction : "save", callback, storeName);
        },
        doAction: function(action, dataIn) {
            var nextState = this.currentState.actions[action](this, dataIn);
            this._transitionTo(nextState);
        },
        _create: function() {
            this._initStores();
            this._initTemplates();
            this._initStates();
            this.data = this.options.initialData;
            this.dataLoaded = true;
            this._transitionTo(this.initialStateName);
            this._registerInstance();
        },
        _initStores: function() {
            var stores = {};
            var defaultStore = null;
            var defaultStoreName = null;
            var that = this;
            if (this.options.stores) {
                $.each(this.options.stores, function(i) {
                    stores[i] = that._getStore(that.options.stores[i]);
                    if (!defaultStore || that.options.stores[i].defaultStore) {
                        defaultStore = stores[i];
						defaultStoreName = i;
                    }
                });
            }
            this.stores = stores;
            this.defaultStoreName = defaultStoreName;
        },
        _initTemplates: function() {
            var templates = {};
            var that = this;
            if (this.options.templates) {
                $.each(this.options.templates, function(i) {
                    templates[i] = that._getTemplate(that.options.templates[i]);
                });
            }
            this.templates = templates;
        },
        _initStates: function() {
            var states = {};
            var initialStateName = null;
            var that = this;
            if (this.options.states) {
                $.each(this.options.states, function(i) {
                    if (!initialStateName || that.options.states[i].initialState) {
                        initialStateName = i;
                    }
                    states[i] = that._getState(that.options.states[i]);
                });
            }
            this.states = states;
            this.initialStateName = initialStateName;
        },
        //convention: if args is a string, that string is the url
        _getStore: function(argsIn) {
            var args = argsIn;
            if (typeof argsIn === "string") {
                args = {
                    url: argsIn
                };
            }
            return new $.udel.store(args);
        },
        //convention: if args is a string, that string is the url
        //Also, if a templateBaseUrl is provided and the url does not have http at the front,
        // the url is appended to the templateBaseUrl
        _getTemplate: function(argsIn) {
            var args = argsIn;
            if (typeof argsIn === "string") {
                args = {
                    url: argsIn
                };
            }
            if (this.templateBaseUrl && args.url && !args.url.startsWith("http")) {
                args.url = this.templateBaseUrl + args.url;
            }
            return new $.udel.template(args);
        },
        //convention: if args is a string, that string is the template name
        _getState: function(argsIn) {
            var args = argsIn;
            if (typeof argsIn === "string") {
                args = {
                    template: argsIn
                };
            }
            return new $.udel.state(args);
        },
        _transitionTo: function(newStateName) {
            if (!newStateName || !this.states[newStateName]) {
                return;
            }
            var state = this.states[newStateName];
            this.currentState = state;
            if (state) {
                var that = this;
                var callback = function() {
                    if (!state.store) {
                        that.currentStore = that.defaultStore;
                    }
                    else {
                        that.currentStore = that.stores[state.store];
                    }
                    if (state.init) {
                        state.init.apply(that || window, [that]);
                    }
                };
                if (state.templateName) {
                    this.templates[state.templateName].applyTemplate(this.data, this.element, callback, state.keepPreviousTemplate);
                }
                else {
                    callback();
                }
            }
        },
        _fetchFromStore: function(args, action, callback, storeName) {
            var that = this;
            //wait up to 10 seconds for a data load.  essentially, a 10 second timeout
            //TODO: make this configurable and sync with fetch!
            $.condWait(50, 200, function() {
                return that.dataLoaded;
            }, that, function() {
                that._fetchFromStoreWorker(args, action, callback, storeName);
            }, that);
        },
        _fetchFromStoreWorker: function(args, action, callback, storeName) {
            this.dataLoaded = false;
            if (!storeName) {
                storeName = this.defaultStoreName;
            }
            var store = storeName ? this.stores[storeName] : null;
            if (store) {
                var that = this;
                store.fetch(action, function(data) {
                    that.dataLoaded = true;
					if (callback) {
						callback(data);
					}
                }, args);
            }
            else {
                this.dataLoaded = true;
				if (callback) {
					callback(args);
				}
            }
        }
    });
})(jQuery);
