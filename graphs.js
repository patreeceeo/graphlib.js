var Graphs = graphsModule(ensureAttr);

function ensureAttr (object, attrName, defaultValue) {
    object[attrName] = object[attrName] || defaultValue;
}

// Verify the result of reducePaths by summing the ultimate quantities
// for each name in both `graph` and the `balances` from which it was
// generated.
function graphRepresentsBalances (graph, balances) {
    var graphTotals = {},
        balancesTotals = {};

    for (nodeName in graph) {
        var node = graph[nodeName];
        for (nextNodeName in node.edges) {
            ensureAttr(graphTotals, nodeName, 0);
            ensureAttr(graphTotals, nextNodeName, 0);
            var weight = node.edges[nextNodeName].weight;
            graphTotals[nodeName] -= weight;
            graphTotals[nextNodeName] += weight;
        }
    }

    balances.forEach(function (bal) {
        ensureAttr(balancesTotals, bal.ingress, 0);
        balancesTotals[bal.ingress] += bal.amount;
        bal.egresses.forEach(function (egress) {
            ensureAttr(balancesTotals, egress, 0);
            balancesTotals[egress] -= bal.amount / bal.egresses.length;
        });
    });
   
    for (nodeName in graphTotals) {
        if(graphTotals[nodeName] !== balancesTotals[nodeName]) {
            return false;
        }
    }

    for (nodeName in balancesTotals) {
        if(graphTotals[nodeName] !== balancesTotals[nodeName]) {
            return false;
        }
    }

    return true;
}

var balancesSets = [
    [
        { ingress: "Fred", amount: 40, egresses: ["Fred", "Scooby", "Shaggy", "Dafny"] },
        { ingress: "Thelma", amount: 10, egresses: [ "Scooby", "Shaggy"] },
        { ingress: "Fred", amount: 200, egresses: ["Dafny", "Thelma", "Scooby", "Shaggy"] },
        { ingress: "Shaggy", amount: 500, egresses: ["Scrappy"] }
    ],
    [
        { ingress: "Fred", amount: 40, egresses: ["Fred", "Scooby", "Shaggy", "Dafny"] },
        { ingress: "Thelma", amount: 10, egresses: [ "Scooby", "Shaggy"] },
        { ingress: "Fred", amount: 200, egresses: ["Dafny", "Thelma", "Scooby", "Shaggy"] },
        { ingress: "Shaggy", amount: 500, egresses: ["Thelma", "Scrappy"] }
    ]
]

balancesSets.forEach(function (balances, index) {
    var graph = Graphs.balancesToGraph(balances);
    Graphs.shortenPaths(graph);
    console.log('=== For Set',index,'===');
    Graphs.forEachTransferFormatedLine(graph, console.log);
    if(!graphRepresentsBalances(graph, balances)) {
        console.error("Wrong Answer :(");
    }
});




function graphsModule(ensureAttr) {
    // Graphs take the following form: {
    //     String nodeName: {
    //         `edges`: {
    //              0 or more String nodeName: {
    //                  optional `weight`: Number
    //              }
    //          }
    //     }
    // }
    "use strict"


    // Convert an array of objects of the following form into 
    // a weighted directed graph: { 
    //         `ingress`: String, 
    //         `amount`: Number, 
    //         `egresses`: [ 1 or more String] 
    //     }
    function balancesToGraph (balances) {
        var graph = {};
        balances.forEach(function addIngressNode (bal) {
            ensureAttr(graph, bal.ingress, {edges: {}});
            bal.egresses.forEach(function connectEgressNodes (egress) { 
                ensureAttr(graph, egress, {edges: {}});
                ensureAttr(graph[egress].edges, bal.ingress, {weight: 0});
                graph[egress].edges[bal.ingress] += bal.amount/bal.egresses.length;
            });
        }); 
        return graph;
    };

    // Call a function once for each line in a human readable presentation
    // of a graph
    function forEachTransferFormatedLine (graph, fn) {
        var egress = null,
            ingress = null;
        for(egress in graph) {
            if(!isSink(graph[egress], egress)) {
                fn(egress + " => ");
                for(ingress in graph[egress].edges) {
                    fn("    " + ingress + " " + graph[egress].edges[ingress].weight);
                }
            }
        }
    }

    // Modifying the graph in-place, reconfigure it so that the edges 
    // represent the same ultimate transference of quantities using the fewest
    // possible edges. Each path should use only one edge. The nodes should be
    // preserved.
    function shortenPaths(graph) {
        var foundNonTrivialPaths = true,
            startNode = null,
            startNodeName = null,
            minWeight = 0;

        while(foundNonTrivialPaths) {
            foundNonTrivialPaths = false;
            for(startNodeName in graph) {
                startNode = graph[startNodeName];
                depthFirstSearch(
                    startNodeName, 
                    graph, 
                    followingNonTrivialPath(
                        [],
                        [
                            correctMinimumWeight,
                            modifyStep
                        ],
                        [
                            resetMinimumWeight
                        ]
                    )
                );
            }
        }

        function followingNonTrivialPath (startFns, stepFns, endFns) {
            return function inner (path, pathIndex) {
                if(path.length > 1) {
                    foundNonTrivialPaths = true;
                    startFns.forEach(function eachStartFn (startFn) {
                        startFn.call(this, path, pathIndex);
                    });
                    stepFns.forEach(function eachStepFn (fn) {
                        path.forEach(stepFns);
                    });
                    endFns.forEach(function eachEndFn (endFn) {
                        endFn.call(this, path, pathIndex);
                    });
                }
            }
        }

        function modifyStep (step, stepIndex, path) { 
            if(step.edge.weight === minWeight) {
                delete step.node.edges[step.nextNodeName];
            }
            else {
                // reduce weight of edge by lowest weight along non-trivial path
                step.edge.weight -= minWeight;
            }

            if(stepIndex === path.length - 1) {
                // get/create edge between start and end of current path
                ensureAttr(startNode.edges, step.nextNodeName, { weight: 0});
                startNode.edges[step.nextNodeName].weight += minWeight;    
            } 
        }

        function correctMinimumWeight (step) {
            if(step.edge != null && step.edge.weight > 0 && minWeight === 0 || minWeight > 0 && step.edge.weight < minWeight) {
                minWeight = step.edge.weight;
            }
        }
        
        function resetMinimumWeight () {
            minWeight = 0;
        }
    }


    // Kind of self-explanatory. Stops searching when it detects a loop.
    function depthFirstSearch (startNodeName, graph, fn) {
        var pathIndex = 0,
        safeDFS = addLoopDetection(dfs, fn);
        function addLoopDetection(fn, callback) {
            return function detectLoop (nodeName, path) {
                var loopLength = Math.floor(path.length / 2);
                var sentinelStep = path.length > 2 ? path[loopLength] : void 0
                if(sentinelStep != null && sentinelStep.node === graph[nodeName]) {
                    callback(path, pathIndex);
                }
                else {
                    fn(nodeName, path);
                }
            }
        }

        function dfs (nodeName, path) {
            var node = graph[nodeName],
                nextNodeName = null;
            for(nextNodeName in node.edges) {
                var newPath = path.slice(0);
                newPath.push({node: node, edge: node.edges[nextNodeName], nodeName: nodeName, nextNodeName: nextNodeName});
                safeDFS(nextNodeName, newPath);
            }
            if(isSink(node, nodeName)) {
                fn(path, pathIndex);
                pathIndex++;
            }
        };
        safeDFS(startNodeName, []);
    }

    // Can you get to any other node from this node?
    function isSink (node, nodeName) {
        var result = true,
            nextNodeName = null;
        for (nextNodeName in node.edges) {
            if(nextNodeName != nodeName) {
                result = false;
            }
        }
        return result;
    }

    return {
        balancesToGraph: balancesToGraph,
        shortenPaths: shortenPaths,
        forEachTransferFormatedLine: forEachTransferFormatedLine
    };   
    
};

