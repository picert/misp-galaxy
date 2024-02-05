document$.subscribe(function () {

    const NODE_RADIUS = 8;

    // Function to parse the table data
    function parseFilteredTable(tf) {
        var data = [];
        tf.getFilteredData().forEach((row, i) => {
            data.push({ source: row[1][0], target: row[1][1], level: row[1][2] });
        }
        );
        return data;
    }

    function processNewData(newData) {
        // Extracting new nodes
        var newNodes = Array.from(new Set(newData.flatMap(d => [d.source, d.target])))
            .map(id => ({ id }));

        // Preparing the links in the required format
        var newLinks = newData.map(d => ({ source: d.source, target: d.target }));
        return { newNodes, newLinks };
    }

    // Function to create Force-Directed Graph
    function createForceDirectedGraph(data, elementId) {
        // Extract nodes and links
        var nodes = Array.from(new Set(data.flatMap(d => [d.source, d.target])))
            .map(id => ({ id }));

        var links = data.map(d => ({ source: d.source, target: d.target }));

        console.log("Nodes")
        console.log(nodes);
        console.log("Links")
        console.log(links);

        // Set up the dimensions of the graph
        var width = 1000, height = 1000;

        // Append SVG for the graph
        var svg = d3.select(elementId).append("svg")
            .attr("width", width)
            .attr("height", height);

        // Create a force simulation
        var simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id))
            .force("charge", d3.forceManyBody())
            .force("center", d3.forceCenter(width / 2, height / 2))
            .alphaDecay(0.02); // A lower value, adjust as needed

        // Create links
        var link = svg.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("stroke-width", d => Math.sqrt(d.value));

        // Create nodes
        var node = svg.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(nodes)
            .enter().append("circle")
            .attr("r", NODE_RADIUS)
            .attr("fill", "#69b3a2");

        // Define drag behavior
        var drag = d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);

        // Apply drag behavior to nodes
        node.call(drag);

        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            // Do not reset the fixed positions
            if (!event.active) simulation.alphaTarget(0);
        }

        // Update positions on each simulation 'tick'
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });

        return Object.assign(svg.node(), {
            update({ newNodes, newLinks }) {
                // Process new nodes and maintain the existing ones
                const oldNodesMap = new Map(node.data().map(d => [d.id, d]));
                nodes = newNodes.map(d => Object.assign(oldNodesMap.get(d.id) || {}, d));

                // Update nodes with new data
                node = node.data(nodes, d => d.id)
                    .join(
                        enter => enter.append("circle")
                            .attr("r", NODE_RADIUS)
                            .attr("fill", "#69b3a2"),
                        update => update,
                        exit => exit.remove()
                    );

                node.call(drag);

                // Process new links
                const oldLinksMap = new Map(link.data().map(d => [`${d.source.id},${d.target.id}`, d]));
                links = newLinks.map(d => Object.assign(oldLinksMap.get(`${d.source.id},${d.target.id}`) || {}, d));

                // Update links with new data
                link = link.data(links, d => `${d.source.id},${d.target.id}`)
                    .join(
                        enter => enter.append("line")
                            .attr("stroke-width", d => Math.sqrt(d.value)),
                        update => update,
                        exit => exit.remove()
                    );

                // Restart the simulation with new data
                simulation.nodes(nodes);
                simulation.force("link").links(links);
                simulation.alpha(1).restart();
            }
        });
    }

    // Find all tables that have a th with the class .graph and generate Force-Directed Graphs
    document.querySelectorAll("table").forEach((table, index) => {
        var graphHeader = table.querySelector("th.graph");
        if (graphHeader) {
            // Initialize TableFilter for the table
            var tf = new TableFilter(table, {
                base_path: "https://unpkg.com/tablefilter@0.7.3/dist/tablefilter/",
                highlight_keywords: true,
                col_2: "checklist",
                col_widths: ["350px", "350px", "100px"],
                col_types: ["string", "string", "number"],
                grid_layout: false,
                responsive: false,
                watermark: ["Filter table ...", "Filter table ..."],
                auto_filter: {
                    delay: 100 //milliseconds
                },
                filters_row_index: 1,
                state: true,
                rows_counter: true,
                status_bar: true,
                themes: [{
                    name: "transparent",
                }],
                btn_reset: {
                    tooltip: "Reset",
                    toolbar_position: "right",
                },
                toolbar: true,
                extensions: [{
                    name: "sort",
                },
                {
                    name: 'filtersVisibility',
                    description: 'Sichtbarkeit der Filter',
                    toolbar_position: 'right',
                }],
            });

            tf.init();
            var data = parseFilteredTable(tf);
            var graphId = "graph" + index;
            var div = document.createElement("div");
            div.id = graphId;
            table.after(div);
            var simulation = createForceDirectedGraph(data, "#" + graphId);

            // Function to filter the table data and update the graph
            function filterTableAndGraph() {
                var filteredData = parseFilteredTable(tf);
                var { newNodes, newLinks } = processNewData(filteredData);

                // Restart the simulation with filtered data
                simulation.update({ newNodes: newNodes, newLinks: newLinks });
            }

            // Listen for table filtering events
            tf.emitter.on(['after-filtering'], filterTableAndGraph);
        }
    });
});
