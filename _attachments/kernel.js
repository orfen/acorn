// need to move everything out of .doc that isn't in the database!!!!!
/* considerations for optimisation:
http://devign.me/tree-rendering-in-client-side-no-recursion/
http://jsperf.com/create-nested-dom-structure
https://github.com/substack/js-traverse/




*/


var kernel = {
    DATABASE: "", //want to get rid of this
    DATABASEPATHS: {},
    NESTMAX: 1,
    OPTS: {
        include_docs: "true"
    },
    ROOT: "000000root",
    //DATABASEPATHS: {}, - i may have been meaning to put something else here? (forgotten copypasta)
    tree: {},
    subtrees: {},
    user: "anon",
    activervsID: "acornbundle",
    initcallback: function () {},
    ajaxcallback: function () {},

    init: function (DATABASE, initcallback, ajaxcallback, user, activervsID) {
        this.DATABASE = DATABASE;
        this.initcallback = initcallback;
        this.ajaxcallback = ajaxcallback;
        if(user)
            this.user = user;
        if(activervsID)
            this.activervsID = activervsID;         

        //this.paths["000000root"] = "";
        // kernel.DATABASEPATHS[this.DATABASE] = {"000000root":""};//.paths["000000root"] = "";

        var $changes = $.couch.db(this.DATABASE)
            .changes();
        $changes.onChange = function (data) {
            console.log(data);
            this.reflectChanges(data);
        }

        this.db = $.couch.db(this.DATABASE);
        this.db.allDocs(this.OPTS)
            .then(function (data) {
      //       kernel.tree.parent = kernel.tree;
            kernel.tree = kernel.callback(data, 0, kernel.DATABASE);
            kernel.initcallback()
        });

        //$changes.stop();
        return;
    },

    callback: function (data, nest, db) {
        return kernel.buildtree(data.rows[0], data, nest, db);
    },


    buildtree: function (node, data, nest, db) {

        if (node.id == kernel.ROOT) node.parent = node;
        node.db = db
        node.nest = nest;
        if (!kernel.DATABASEPATHS[node.db]) kernel.DATABASEPATHS[node.db] = {};

        node.path = kernel.DATABASEPATHS[node.db][node.id] = kernel.buildpath(node);

        $.each(data.rows, function () {
            if (this.doc.contentID == node.doc.content) {
                node.content = this;
            }
        });

        if (!node.content) node.content = {
            "doc": {
                "contentID": "nullcontent",
                "html": "NULL CONTENT - cannot edit!"
            }
        };


        node.children = [];
        $.each(node.doc.parentTo, function () {
            childnodeID = this;
            var childnode;
            $.each(data.rows, function () {
                if (this.doc.nodeID == childnodeID) {
                    node.children.push(this);
                    childnode = this;
                    //escape each
                }
            });

            if (!childnode) return;
            childnode.parent = node;

            //  var childcontent;
            // childnode.db = node.db //means repitition, yes - oh well

            /*$.each(data.rows, function () {			///why was this even here! (already takes place above)
                if (this.doc.contentID == childnode.doc.content)
                    childcontent = this;
                //escape each
            });
            childnode.content = childcontent;*/

            kernel.buildtree(childnode, data, nest, db);

        });

        if (node.doc.parentTo.length == 0 && node.content.doc.link && nest < kernel.NESTMAX) {
            if(window.location.origin == "http://" + node.content.doc.link.split('/')[2])
                if((linkdb = node.content.doc.link.split('/')[3]) != node.db)
                    $.couch.db(linkdb)
                        .allDocs(kernel.OPTS)
                        .then(function (data) {
                        console.log(node.content.doc.link);
                        kernel.subtrees[linkdb] = kernel.callback(data, nest + 1, linkdb);
                        ajaxnode = kernel.getNodeFromDocID(kernel.getURLParameter("?" + node.content.doc.link.split('?')[1], "docID"), linkdb);
                        if(ajaxnode)
                        {
                            console.log(ajaxnode.parent);
                           console.log(kernel.subtrees[linkdb])
                          //node.vischildren = [];
                          //  node.vischildren[0] = ajaxnode;
                           node.children[0] = ajaxnode;
                           // node.vischildren[0].visparent = node; - treeware has to manage escaping, unfortunately!
                            console.log(kernel.tree);
                            kernel.ajaxcallback(node); //remember, still need to create ui response for ajax
                        }
                        else
                            console.log("failed attempt to load: " + node.content.doc.link);
                    });
        }

        return node;

    },

    buildpath: function (node) {
        if (node.parent != node && node.parent.db == node.db) return kernel.buildpath(node.parent) + node.id + "/"

        return "" //node.id
    },

    getNode: function (node, db) { // need to handle db and update references accordingly
        path = node; //this.paths[node]

        path = path.split("/");
        path = path.splice(0, path.length - 1);
        
        var thetree = kernel.tree
        if(db)
            thetree = kernel.subtrees[db];

        if (path.length == 0) return thetree;

        function findChild(node, index) {
            var result = null;
            var id = path[index];

            $.each(node.children, function () {
                if (this.doc._id == id) {
                    result = this;

                    return false;
                }
            });

            if (++index == path.length) return result;

            return findChild(result, index);
        }

        return findChild(thetree, 0);
    },
    
    getNodeFromDocID: function (id, db) {

        if(db)
            return kernel.getNode(kernel.DATABASEPATHS[db][id],db);

        for (var i in kernel.DATABASEPATHS)
        {
          if (nodepath = kernel.DATABASEPATHS[i][id])
            return kernel.getNode(nodepath);
        }
        return false;
    },

    getChildren: function (node) {
        l_node = this.getNode(node);

        return l_node.children;
    },

    addChildNodeOnly: function (l_node, index, contentID, callbackf) {
        var returnnode = {};
        n = contentID;
        nodeValue = {
            'nodeID': n + 'n',
            'parentTo': [],
            'content': n
        };

        $.couch.db(kernel.getNode(l_node).db)
            .saveDoc(nodeValue)
            .then(function (json) {
            returnnode.doc = nodeValue;
            returnnode.id = json.id;
            returnnode.key = json.id;
            returnnode.value = {};
            returnnode.value.rev = json.rev;

            var parentnode = kernel.getNode(l_node)
            parentnode.children.splice(index, 0, returnnode);
            parentnode.doc.parentTo.splice(index, 0, returnnode.id);
            returnnode.parent = parentnode;
            returnnode.children = [];
            returnnode.db = kernel.getNode(l_node).db;

            returnnode.path = kernel.DATABASEPATHS[selectrect.db][returnnode.id] = kernel.buildpath(returnnode);

            $.couch.db(kernel.getNode(l_node).db)
                .openDoc(parentnode.id)
                .then(function (json) {
                json['parentTo'].splice(index, 0, n + "n");
                $.couch.db(kernel.getNode(l_node).db)
                    .saveDoc(json)
                    .then(function () {
                    callbackf(returnnode);
                });
            });
        })

        return;
    },

    addChild: function (l_node, index, content, callbackff) {
        var thiskernel = this;
        var d = new Date();
        var n = d.getTime() + "";
        newChild = {
            'contentID': n,
            'html': content,
            'author': kernel.user,
            'writtenFor': [kernel.activervsID]
        };

        thensave = function (savednode) {
            $.couch.db(savednode.db)
                .saveDoc(newChild)
                .then(function (json) {
                savednode.content = {}
                savednode.content.doc = newChild;
                savednode.content.id = json.id;
                savednode.content.key = json.id;
                savednode.content.value = {};
                savednode.content.value.rev = json.rev;
                console.log(savednode);
                callbackff(savednode); //*/ - this was cause of HUGE problems!! never forget
            });
        }
        this.addChildNodeOnly(l_node, index, n, thensave);

        return;
    },

    saveNodeContent: function (node) {
        thiskernel = this;
        $.couch.db(node.db)
            .openDoc(node.content.id)
            .then(function (json) {
            json['html'] = node.content.doc.html;
            $.couch.db(node.db)
                .saveDoc(json);
        });

        return;
    },

    reflectChanges: function (data) {
        console.log(data);

        $.couch.db(this.DATABASE)
            .getDbProperty('_changes', {
            since: 0
        })
            .then(function (data) {
            $.each(data.results, function (i) {
                data.results[i].changes_string = JSON.stringify(data.results[i].changes);
            });
            console.log(data);
        });

        return;
    },

    moveNode: function (node, newparentnode, newindex) {
        $.couch.db(this.DATABASE)
            .openDoc(node.doc.parent.id)
            .then(function (json) { //close old parent (db first)
            parent = node.doc.parent;
            index = parent.doc.children.indexOf(node);
            json['parentTo'].splice(index, 1);
            $.couch.db(thiskernel.DATABASE)
                .saveDoc(json);

            parent.doc.children.splice(index, 1);
            parent.doc.parentTo.splice(index, 1);

        });

        $.couch.db(this.DATABASE)
            .openDoc(newparentnode.id)
            .then(function (json) { //assign new parent (db first)
            json['parentTo'].splice(newindex, 0, node.id);
            $.couch.db(thiskernel.DATABASE)
                .saveDoc(json);

            newparentnode.doc.children.splice(index, 0, node);
            newparentnode.doc.parentTo.splice(index, 0, node.id);

        });

        function updateallpaths(thisnode) { //recursively *update* paths of that node and children
            kernel.paths[thisnode.doc._id] = kernel.buildpath(thisnode);
            if (this.doc.children.length) {
                $.each(thisnode.doc.children, function () {
                    updateallpaths(this);
                });
            }
        }

        updateallpaths(node);

    },

    deleteNode: function (node, callbackf) { //not recursive, promotes immediate sibling at index 0
        //loose content will need purging by application, unless deleteNodeAndContent is used
        if (node.id == this.ROOT) return callbackf();
        thiskernel = this;
        parent = node.parent;
        index = node.parent.children.indexOf(node);
        $.couch.db(node.db)
            .openDoc(node.parent.id)
            .then(function (json) { //remove from parent (db first)
            json['parentTo'].splice(index, 1);
            $.couch.db(node.db)
                .saveDoc(json)
                .then(function () {
                parent.children.splice(index, 1);
                parent.doc.parentTo.splice(index, 1);

                $.couch.db(node.db)
                    .openDoc(node.id)
                    .then(function (doc) { //remove from db
                    $.couch.db(node.db)
                        .removeDoc(doc)
                        .then(callbackf(parent));
                });
            });
        });
        return;



        //remove from DOM ?? - not bothering for now
    },

    deleteContent: function (content) {
        //delete content (db first)         
    },

    deleteAndContent: function (content) {
        //future - will need to check tree for all refs, or maintain array list of duplicates
    },
    
    navigate: function (l_node, rsvID) {
        node = kernel.getNode(l_node);
        window.open("/" + node.db + "/_design/" + rsvID + "/index.html?docID=" + node.id)
    },
    
    
    getURLParameter: function (str, name) {
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(str)||[,""])[1].replace(/\+/g, '%20'))||null;
    },
    
    installTree: function () {
        /*
        If installing in a new DB, create a doc for 000000root node

        {
           "parentTo": [
           ],
           "content": "rootcontent"
        } 
        and 000000root's content:

        {
            "html": "ROOT!<br/><br/><br/><img src='http://localhost:5984/_utils/image/logo.png'><br/><br/>[Insert] new child.<br/>[Enter] new sibling.<br/>[Backspace] to edit then [Enter] when done.<br/>[Delete] to delete!",
           "contentID": "rootcontent"
        }
        root's content .rvsID decides if it is a acornbundle install (new user) or not - all db permissions for that user are prefixed by their user db name*/
    },
    
    installUserTree: function () {
    }

};
