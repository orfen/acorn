var kernel = {
                   DATABASE: "user",
                   OPTS: {include_docs: "true"},
                   ROOT: "000000root",
                   tree: null,
                   paths: {},
                   init: function() {
                       this.db = $.couch.db(this.DATABASE);
                       this.db.allDocs(this.OPTS).then(this.callback);
                   },
                   callback: function(data) {
                        function buildpath (node){
	                    	if(node.doc.parent != node.doc.id)
                    			return buildpath(node.doc.parent) + node.id + "/"
	                       	return ""//node.id
                    	}

                        function buildtree (node, data){
                           if(node.doc.parentTo){
                               var parent = node.doc;
                               parent.children = [];
                               $.each(node.doc.parentTo, function(){
                                   childnodeID = this;
                                   var childnode;
                                   $.each(data.rows, function(){
                                       if(this.doc.nodeID == childnodeID) {
                                           parent.children.push(this);
                                           childnode = this;
                                       }
                                   });
                                   if(!childnode)
                                       return;
                                   childnode.doc.parent = node;
                      
                                   var childcontent;
                                   kernel.paths[childnode.doc._id] = buildpath(childnode);
                                   $.each(data.rows, function(){
                                       if(this.doc.contentID == childnode.doc.content)
                                           childcontent = this;
                                   });
                                   childnode.content = childcontent;
                                   buildtree(childnode,data);
                               });
                               return (node);
                           }
                       }  

                       kernel.tree = buildtree(data.rows[0], data);
                   },
                   getNode: function(path) {
                       path = path.split("/");
                       path = path.splice(0, path.length-1);
                       function findChild(node, index) {
                            var result = null;
                            var id = path[index];
                            $.each(node.doc.children, function() {
                                if(this.doc._id == id) {
                                    result = this;
                                    return false;
                                }
                            });
                            if(++index == path.length) {
                                return result;
                            }
                            return findChild(result, index);
                       }
                       return findChild(kernel.tree, 0);
                   },
                   getChildren: function(node) {                       
                       l_node = this.getNode(node);   
                       return l_node.doc.children;
                   },
                   addChildren: function(l_node, child) {
                       return this.node.push(child);
                   }
};

kernel.init();
