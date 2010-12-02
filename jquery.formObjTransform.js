//based on https://gist.github.com/615281
//clearForm and  clearFields taken from https://github.com/malsup/form
//example form from tobiascohen.com/files/stackoverflow/jquery-form-serializeObject.html
/*
 * jquery.formObjTransform.js
 * Adds the following to the jquery namespace:
 *   $.flattenObject(toFlatten/{})->{}:
 *		Returns a map of the flattened object using dot/bracket notation ex.: ({a:{b:"",c:["",""]}}-> {'a.b': "", 'a.c': ["",""]}.  
 * 		If any object keys in toFlatten contain a "." or "[", output is likely incorrect.  Empty objects and undefined values are ignored.
 *      Not circular reference safe.
 *   $.fn.formToObj()->{}: 
 *		Takes the inputs, selects, and textareas and parses them into an object.  If names have a dot or [], parsed appropriately.
 *   $.fn.objToForm(obj/{}, clearFirst/bool):
 *		Takes the object and places the variables into select, textarea, and input nodes of the same name.
 * 		If clearFirst is true, will blank out the form before applying.
 *   $.fn.clearForm():
 *		Clears or deselects all select, textarea, and input nodes contained.
 *   $.fn.clearFields():
 *   $.fn.clearInputs():
 *		Clears or deselects a select, textarea, and input node.
 *   TODO: $.expandObject(toExpand/{}, expandArrays/bool)->{}:
 *		expandArrays is true by default.  reverse of $.flattenObject().
 *		Returns a map of the flattened object using dot/bracket notation ex.: ({'a.b': "", 'a.c': ["",""]}->{a:{b:"",c:["",""]}}.
 */
(function($) {
	var parseFormVal = function(val) {
        if (val === "") {
            return null;
        }
        if (val === "true") {
            return true;
        }
        if (val === "false") {
            return false;
        }
        if (val === String(parseInt(val, 10))) {
            return parseInt(val, 10);
        }
        if (val === String(parseFloat(val))) {
            return parseFloat(val);
        }
        return val;
    };
	var addToObject = function(obj, name, value) {
	    var pkg = name.split('.', 1)[0];
	    if ((pkg.length + 1) < name.length) {
	        obj[pkg] = addToObject(obj[pkg] || {}, name.substring(pkg.length + 1), value);
	        return obj;
	    }
	    if (obj[name]) {
	        if ($.isArray(obj[name])) {
	            obj[name].push(value);
	        }
	        else {
	            obj[name] = [obj[name], value];
	        }
	    }
	    else {
	        obj[name] = value;
	    }
        return obj;
    };
	var addToObjectOrArray = function(obj, name, value) {
		var pkg;
		var subPkg;
		if ($.isArray(obj)) {
			//add to array:  better start with a '['
			pkg = Number(name.substr(1, name.indexOf("]")-1));
			subPkg = name.substr(name.indexOf("]")+1);
		}
		else {
			//add to object: no '.' or '[' in package names-- will not play nicely!
	    	pkg = name.split('.', 1)[0].split('[',1)[0];
			subPkg = name.substr(pkg.length);
		}
		if (subPkg.length == 0) {
			//just set the value
			if ("undefined" == typeof obj[pkg]) {
				obj[pkg] = value;
			}
			else if ($.isArray(obj[pkg])) {
		        obj[pkg].push(value);					
			}
		    else {
		        obj[pkg] = [obj[pkg], value];
		    }
		}
		else {
			//recurse down another level-- not circular reference safe!
			var isNextArray = ("[" == subPkg.substr(0,1));
			if (isNextArray) {
				obj[pkg] = addToObjectOrArray(obj[pkg] || [], subPkg, value);
			}
			else {
				obj[pkg] = addToObjectOrArray(obj[pkg] || {}, subPkg.substr(1), value);					
			}
		}
        return obj;
    };
    $.fn.formToObj = function() {
        var toRet = {};
        $('input[type=text][name],input[type=hidden][name],textarea[name]', this).each(function(i) {
            if (this.value) {
                addToObjectOrArray(toRet, this.name, parseFormVal(this.value));
            }
        });
        $('input[type=checkbox][name],input[type=radio][name]', this).each(function(i) {
            if (this.checked) {
                addToObjectOrArray(toRet, this.name, parseFormVal(this.value));
            }
        });
        $('select[name]', this).each(function(i) {
            var select = this;
            $("option", this).each(function(j) {
                if (this.selected) {
                    addToObjectOrArray(toRet, select.name, parseFormVal(this.value));
                }
            });
        });
        return toRet;
    };
    $.flattenObject = function(obj, prefix, ret) {
        var ret = ret || {};
		if ($.isArray(obj)) {
			for (var i = 0; i < obj.length;i++) {
				if (undefined !== obj[i]) {
					$.flattenObject(obj[i], prefix ? (prefix + "[" + i + "]") : ("[" + i + "]"), ret);
				}
			}
		}
		else if ((typeof obj == 'object') && (null !== obj)) {
            $.each(obj, function(i) {
				if (undefined !== obj[i]) {
					$.flattenObject(obj[i], prefix ? (prefix + "." + i) : i, ret);
				}
            });
		}
		else {
			if (prefix) {
				ret[prefix] = String(obj);
			}
			else {
				ret = String(obj);
			}
		}
		return ret;
    };
    $.fn.objToForm = function(obj, clearFirst) {
        var fdoc = $.flattenObject(obj);
        var that = $(this);
        if (clearFirst) {
            that.clearForm();
        }
		var arrays = {};
        $.each(fdoc, function(i) {
            that.children('input[name="' + i + '"],textarea[name="' + i + '"],select[name="' + i + '"]').val($.isArray(fdoc[i]) ? fdoc[i] : [fdoc[i]]);
			if (i.match(/]$/)) {
				var aryName = i.substring(0,i.lastIndexOf("["));
				var index = Number(i.substring(i.lastIndexOf("[")+1, i.length-1));
				arrays[aryName] = arrays[aryName] ? arrays[aryName] : [];
				arrays[aryName][index] = fdoc[i];
			}
        });
        $.each(arrays, function(i) {
            that.children('input[name="' + i + '"],textarea[name="' + i + '"],select[name="' + i + '"]').val(arrays[i]);
        });
    };
    $.fn.clearForm = function() {
        return this.each(function() {
            $('input,select,textarea', this).clearFields();
        });
    };
    $.fn.clearFields = $.fn.clearInputs = function() {
        return this.each(function() {
            var t = this.type,
                tag = this.tagName.toLowerCase();
            if (t == 'text' || t == 'password' || tag == 'textarea') {
                this.value = '';
            }
            else if (t == 'checkbox' || t == 'radio') {
                this.checked = false;
            }
            else if (tag == 'select') {
                this.selectedIndex = -1;
            }
        });
    };
})(jQuery);
