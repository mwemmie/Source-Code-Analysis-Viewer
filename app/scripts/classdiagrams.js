var graph = new joint.dia.Graph();

var paper = new joint.dia.Paper({
    el: $('#paper'), 
    width: $('#paper').width(), 
    //height: $('#paper').height(), 
    gridSize: 1,
    model: graph
});

var uml = joint.shapes.uml;

function searchDatabase(searchCriteria) {
    $("#showingpackage").html("Showing package " + searchCriteria);

    // The query
    var query= {"statements":[{"statement":"MATCH (javaPackage:JavaPackage { name:'" + searchCriteria + "' })-[CONTAINS_CLASS]->(javaClass:JavaClass)  RETURN javaClass;",
    "resultDataContents":["graph","row"]}]};
    
    displayForQuery(query);
}

function searchWithinClasses(searchCriteria) {

    //console.log("searching for: " + searchCriteria);

    // The query
    var query= {"statements":[{"statement":"MATCH (j:JavaClass) WHERE ANY(fullyQualifiedName IN j.fullyQualifiedName WHERE fullyQualifiedName  =~ '(?i).*" + searchCriteria + ".*') OR ANY(method IN j.publicMethods WHERE method  =~ '(?i).*" + searchCriteria + ".*') OR ANY(var IN j.privateInstanceVariables WHERE var  =~ '(?i).*" + searchCriteria + ".*') RETURN DISTINCT j;",
    "resultDataContents":["graph","row"]}]};

    displayForQuery(query);
}

// takes a given neo4j cypher query and displays the results as UML class diagrams
function displayForQuery(query) {

    // jQuery ajax call - http://stackoverflow.com/questions/29440613/return-the-graph-structure-of-a-neo4j-cypher-query-using-jquery
    var request = $.ajax({
        type: "POST",
        url: "http://localhost:7474/db/data/transaction/commit",
        accepts: { json: "application/json" },
        dataType: "json",
        contentType:"application/json",
        data: JSON.stringify(query),
        //now pass a callback to success to do something with the data
        success: function (data) {
              
              var classes = [];
              var largestHeight = 0;

              //$.each(data.classes, function(index, element) {
              $.each(data.results[0].data, function(index, element) {

                    //console.log(element.name);
                    
                    element.row[0].publicMethods = transformToMultiline(element.row[0].publicMethods, 250);
                    //console.log("publicMethods=" + element.row[0].publicMethods); 

                    element.row[0].privateInstanceVariables = transformToMultiline(element.row[0].privateInstanceVariables, 250);
                    //console.log("privateInstanceVariables=" + element.row[0].privateInstanceVariables);

                    var calculatedWidth = calcMaxWidthForClass(element.row[0]);
                    var calculatedHeight = calcMaxHeightForClass(element.row[0]);
                    if(calculatedHeight > largestHeight) {
                        largestHeight = calculatedHeight;
                    }

                    var newClass
                        = new uml.Class({
                            size: { width: calculatedWidth, height: calculatedHeight },
                            name : element.row[0].name,
                            attributes : element.row[0].privateInstanceVariables,
                            methods : element.row[0].publicMethods, 
                            fullyQualifiedName : element.row[0].fullyQualifiedName
                        });

                        classes.push(newClass);

                });

                graph.resetCells(classes);

                joint.layout.SimpleFitLayout.layout(graph, {

                });

                //paper.fitToContent();

                $("#showingpackage").html("Showing " + classes.length + " results");

        }
    });

    request.done(function(data) {

    });

    request.fail(function(jqXHR, textStatus) {
      alert( "Request failed: " + textStatus );
    });
}

// Given an array of Strings, transform it nito a new array of Strings 
// where the length of any one array element does not exceed the width limit
function transformToMultiline(stringArray, widthLimit) {

    //console.log(stringArray);
    if(typeof stringArray == 'undefined') {
        //console.log("stringArray is undefined");
        return [];
    }

    stringArray = stringArray.map(function(orig) {
        var transformed = "+ " + joint.util.breakText(orig, { width: widthLimit } );
        //console.log(transformed);
        return transformed;
    });

    return stringArray;
}

function calcMaxWidthForClass(classData) {
    var widthLimit = 300;
    var minWidth = 100;
    var pixelWidth = 8;
    var calculatedWidth = 0;

    // find the longest element to determine width
    var maxWidth = classData.name.length;
    $.each(classData.privateInstanceVariables, function(index, element) {
        if(maxWidth < element.length) {
            maxWidth = element.length;
        }
    });

    $.each(classData.publicMethods, function(index, element) {
        if(maxWidth < element.length) {
            maxWidth = element.length;
        }
    });

    calculatedWidth = maxWidth * pixelWidth;

    if(calculatedWidth < minWidth) {
        return minWidth;
    } else if(calculatedWidth < widthLimit) {
        return calculatedWidth;
    } else {
        return widthLimit;
    }
}

function calcMaxHeightForClass(classData) {
    var lineCount = 1;

    $.each(classData.privateInstanceVariables, function(index, element) {
        lineCount = lineCount + element.split(/\r\n|\r|\n/).length;
    });

    $.each(classData.publicMethods, function(index, element) {
        lineCount = lineCount + element.split(/\r\n|\r|\n/).length;
    });

    var pixelHeight = 23;
    return lineCount * pixelHeight;
}

// This layout uses a simple algorithm that displays graph 
// elements from left to right, top to bottom sequentially 
// without overlapping or overflowing paper borders.
joint.layout.SimpleFitLayout = {

    layout: function(graph, opt) {

        opt = opt || {};

        var elements = graph.getElements();

        if(elements.length > 0) {
            var lastElement = graph.getElements().pop();

            var margin = opt.margin || 10;

            // may want to change input of this function to take 
            // in a paper
            var paperWidth = paper.options.width;

            var curX = margin;
            var curY = margin;
            var maxHeightInRow = 0;

            // iterate the elements and position them accordingly
            _.each(elements, function(element, index) {
                var elementSize = element.get('size');
                var newRow = false;

                if(curX + elementSize.width < (paperWidth + margin)) {
                    // use curX
                } else { // time for a new row
                    curX = margin;
                    newRow = true;
                }

                // still need to account for old row
                if(newRow) {
                    curY = curY + maxHeightInRow + margin;
                    maxHeightInRow = 0;
                } 

                if(elementSize.height > maxHeightInRow) {
                    maxHeightInRow = elementSize.height;
                }

                element.set('position', {
                    x: curX,
                    y: curY
                });

                curX = curX + elementSize.width + margin; // next x loc
            });

            paper.setDimensions(paper.options.width, lastElement.get('size').height + lastElement.get('position').y + margin);
        } else {
            paper.setDimensions(margin, margin);
        }
    }

    
};

paper.on('cell:pointerdblclick ',
    function(cellView, evt, x, y) {
        //console.log(cellView.model.attributes);
        $("#classdetails").html('Class=' + cellView.model.attributes.fullyQualifiedName);
    }
);

// given searchCriteria, searches neo4j for any package containing that criteria and displays 
// linkable search results below the search input
function searchPackages(searchCriteria) {

    // clear existing results
    $("#searchresults").html("");

    // The query
    var query= {"statements":[{"statement":"MATCH (n:JavaPackage) WHERE n.name CONTAINS '" + searchCriteria + "' RETURN n",
    "resultDataContents":["row"]}]};

    // jQuery ajax call - http://stackoverflow.com/questions/29440613/return-the-graph-structure-of-a-neo4j-cypher-query-using-jquery
    var request = $.ajax({
        type: "POST",
        url: "http://localhost:7474/db/data/transaction/commit",
        accepts: { json: "application/json" },
        dataType: "json",
        contentType:"application/json",
        data: JSON.stringify(query),
        //now pass a callback to success to do something with the data
        success: function (data) {
                //console.log("package search results:");
                //console.log(data);
                $("#searchresults").append(data.results[0].data.length + " results for package " + searchCriteria + "<br/>");

                $.each(data.results[0].data, function(index, element) {

                    //console.log(element.row[0]);
                    $("#searchresults").append("<a class='packagesearchlink'>" + element.row[0].name + "</a><br/>");
                });

                $(".packagesearchlink").click(function(event) {
                    event.preventDefault();
                    var text = $(event.target).text();
                    searchDatabase(text);
                });
        }
    });

    request.done(function(data) {

    });

    request.fail(function(jqXHR, textStatus) {
      alert( "Request failed: " + textStatus );
    });
}

$("#packagesearchbutton").click(function() {
    searchPackages($("#packagesearchinput").val());
});

// initially load the page with a package listing
searchPackages("");

$("#classsearchbutton").click(function() {
    searchWithinClasses($("#classsearchinput").val());
});



// use this to do something upon right click like 
// pop up a modal
// http://jointjs.com/api#joint.dia.Paper%3aevents
paper.on('cell:contextmenu ',
    function(cellView, evt, x, y) {
        evt.preventDefault();
        console.log(cellView.model.attributes);
    }
);

// on mouse wheel zoom
// http://jsfiddle.net/kumilingus/atnoopkm/
function onMouseWheel(e) {

    e.preventDefault();
    e = e.originalEvent;

    var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail))) / 50;
    var offsetX = (e.offsetX || e.clientX - $(this).offset().left); // offsetX is not defined in FF
    var offsetY = (e.offsetY || e.clientY - $(this).offset().top); // offsetY is not defined in FF
    var p = offsetToLocalPoint(offsetX, offsetY);
    var newScale = V(paper.viewport).scale().sx + delta; // the current paper scale changed by delta

    if (newScale > 0.4 && newScale < 2) {
        paper.setOrigin(0, 0); // reset the previous viewport translation
        paper.scale(newScale, newScale, p.x, p.y);
    }
}

function offsetToLocalPoint(x, y) {
    var svgPoint = paper.svg.createSVGPoint();
    svgPoint.x = x;
    svgPoint.y = y;
    // Transform point into the viewport coordinate system.
    var pointTransformed = svgPoint.matrixTransform(paper.viewport.getCTM().inverse());
    return pointTransformed;
}

paper.$el.on('mousewheel DOMMouseScroll', onMouseWheel);






