(function($) {
/**
  * (c) 2012 Grischa Andreew grischa[at]grischaandreew.de | http://github.com/grischaandreew
  *
  */
	
	$.extend($.couch, {
		// Util function to translate all functions in an object to their String Form
		// <pre><code>
		//   $.couch.functions_toString({
		//    testfn: function(){ alert("test function") }	
		//  });
		// </code></pre>
		functions_toString: function(obj){
			if( $.isFunction(obj) ) return obj.toString();
			if( $.isPlainObject(obj) ) {
				for( var k in obj ) {
					obj[k] = $.couch.functions_toString(obj[k]);
				}
				return obj;
			}
			if( $.isArray(obj) ) {
				for( var i = 0, l = obj.length; i < l; i++ ) {
					obj[i] = $.couch.functions_toString(obj[i]);
				}
				return obj;
			}
			return obj;
		},
		
		// Util function to request an couchdb REST Endpoint
		request: function(obj, options, errorMessage, ajaxOptions) {
			
			var defaultAjaxOpts = {
				contentType: "application/json",
				headers: {
					"Accept": "application/json"
				}
	    };
	    options = $.extend({ successStatus: 200 }, options);
	    ajaxOptions = $.extend(defaultAjaxOpts, ajaxOptions);
	    errorMessage = errorMessage || "Unknown error";
			
	    return $.ajax($.extend($.extend({
	      type: "GET", dataType: "json",
	      beforeSend: function(xhr){
	        if(ajaxOptions && ajaxOptions.headers){
	          for (var header in ajaxOptions.headers){
	            xhr.setRequestHeader(header, ajaxOptions.headers[header]);
	          }
	        }
	      },
	      complete: function(req) {
	        try {
	          var resp = $.parseJSON(req.responseText);
	        } catch(e) {
	          if (options.error) {
	            options.error(req.status, req, e);
	          } else {
	            alert(errorMessage + ": " + e);
	          }
						if( options.complete ) options.complete( req, null, e );
	          return;
	        }
	        if (options.ajaxStart) {
	          options.ajaxStart(resp);
	        }
	        if (req.status == options.successStatus) {
	          if (options.beforeSuccess) options.beforeSuccess(req, resp);
	          if (options.success) options.success(resp);
	        } else if (options.error) {
	          options.error(req.status, resp && resp.error || errorMessage, resp && resp.reason || "no response");
	        } else {
	          alert(errorMessage + ": " + resp.reason);
	        }
					if( options.complete ) options.complete( req, resp, e );
	      }
	    }, obj), ajaxOptions));
	  }
	});
	
	(function(){
		// override old couch.db function to make that extendable
		var oldcouchdb = $.couch.db;
		$.couch.db = function(){
			var d = oldcouchdb.apply(this,arguments);
			$.extend(d,$.couch.db);
			return d;
		};
	})();
	
	$.extend($.couch.db,{
		
		// install or update an design doc
		// <pre><code>
		//  var $db = $.couch.db("default");
		//  $db.installDesignDoc({
		//	"_id": "_design/test",
		//	"views": {
		//		"byCollection": {
		//			"map": function(doc, req){
		//				if (doc.collection) {
		//					emit(doc.collection, doc);
		//				}
		//			}
		//		}
		//	}
		// }, {
		//	success: function(){ alert("Design Document installed/updated."); },
		//  error:   function(){ alert("Design Document can´t installed."); }
		// } );
		// </code></pre>
		installDesignDoc: function( doc, opts ){
			opts = opts || {};
			if( !doc._id ) {
				if( opts.error ) opts.error(null,null);
				else alert('Provide an _id Attribute for Design Document');
				if( opts.complete ) opts.complete(null,null);
				return this;
			}
			
			var splits = String(doc._id).split('/'),
					that = this;
			
			if( splits[0] != "_design" ) {
				if( opts.error ) opts.error(null,null);
				else alert('Provide an valid _id Attribute for Design Document, must start with _design/{id}');
				if( opts.complete ) opts.complete(null,null);
				return this;
			}
			
			function updateDesignDoc(){
				doc = $.couch.functions_toString(doc);
				if( !doc.language ) doc.language = "javascript";
				that.saveDoc( doc, opts );
			}
			
			if( !doc._rev ) {
				// try to load last DesignDoc Revision from DB
				this.openDoc( doc._id,{
					success: function(data){
						if(data._rev){
							doc._rev = data._rev;
						}
						updateDesignDoc();
					},
					error: function(){
						updateDesignDoc();
					}
				});
			} else {
				updateDesignDoc();
				return this;
			}
		},
		
		// remove an Attachement Document
		// to delete eg <code>removeAttachement({_id:"mydoc/attachement", _rev: "1-2345"})</code>
		removeAttachement: function(doc, options) {
      var splits = doc._id.split("/");
      var docid = splits.shift();
      var attachement_id = splits.join("/");
      return $.couch.request({
          type: "DELETE",
          url: this.uri +
               encodeDocId(docid) + "/"+ encodeDocId(attachement_id) +
               encodeOptions({rev: doc._rev})
        },
        options,
        "The attachement could not be deleted"
      );
    }
		
	});
	
})(jQuery);