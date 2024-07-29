import githubData from "./github-data.json" with { type: "json" };
import { fileExtColors } from "./colors.js";

const STRUCTURE_LOOSE_FILE = "__structure_loose_file__";
const MAX_DEPTH = 10;
const MAX_CHILDREN = 8000;
const WIDTH = 1000;
const HEIGHT = 1000;


main();

async function main({
  data = githubData,
  colorEncoding = "type",
  filesChanged = [],
  maxDepth = MAX_DEPTH,
  maxChildren = MAX_CHILDREN,
} = {}) {
  const state = {
    isIntroMessagingComplete: false,
    tourStep: 1,
  };

  const params = {
    gitTagIndex: 0,
    minCircleRadius: 15,
  };

  const messagingText = {
    1: {
      title: "Visualization Quick Tour",
      label: [
        "The practice of computer programming traditionally involves top-to-bottom file structure and  reading code line-by-line, but what if we imagine an entirely novel approach to coding through visual learning?",
        "This project visualizes GitHub repository codebases by displaying project file and directory structure and showing how it changes over time. Directories (green labels) are represented as circles, each sized according its size in bytes and colored based on the predominant file type of its contents. Files are shown within their respective directory circles as text labels. In this example, we are going to visualize D3's shape package (d3-shapes) hosted on GitHub.",
      ],
    },
    2: {
      label:
        "We can go forward in history by clicking the Next Git Tag button, which will update the visualization based on the next GitHub tagged release of d3-shapes. Notice how the upgrade from version 0.0.1 to 0.0.2 increased the src directory radius, i.e. overall file size from 384 KB to 402 KB, as well as add several new files such as catmull-rom.js. This tells us that d3-shapes did major updates in upgrading to the next patch semantic version.",
    },
    3: {
      label:
        'We can also watch a time series depiction of code changes over time by clicking the Play Git Timeline. Now we can almost "watch" a codebase as a movie! This visualization enables us to understand high level codebase changes and pinpoint identify major breaking changes between releases of the entire repository lifetime in only in a matter of seconds.',
    },
    4: {
      label:
        "Finally, we can set the minimum circle radius to control the sizes of circles shown and the number of files shown at a time in order to drill into more deeply nested files and directories in the codebase. Note that setting a small minimum circle radius can lead to overcrowded labels in the visualization. And that's it! Now it's your turn to play with the parameter controls and explore the D3 shapes codebase through this data visualization.",
    },
  };

  const messagingSteps = {
    1: {
      type: "annotationLabel",
      textWrap: 500,
      annotation: [
        {
          note: {
            title: messagingText[1].title,
            label: messagingText[1].label[0],
            bgPadding: 20,
          },
          className: "show-annotation-bg",
          x: 300,
          y: 250,
          dx: 0,
          dy: 0,
        },
        {
          note: {
            label: messagingText[1].label[1],
            bgPadding: 20,
          },
          className: "show-annotation-bg",
          x: 550,
          y: 420,
          dx: 0,
          dy: 0,
        },
      ],
    },
  };

  const continueMessagingTourButton =
    document.querySelector(".continue-message");

  continueMessagingTourButton.addEventListener(
    "click",
    () => messagingTourStepper(state.tourStep)
  );

  const selectedNodeId = null;
  let cachedPositions = {};
  let cachedOrders = {};

  const { colorScale } = getColorSettings;
  const svg = d3.select("#data-viz");

  svg
    .style("overflow", "visible")
    .style("font-family", "monospace")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .append("defs")
    .append("filter")
    .attr("id", "glow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%")
    .append("feGaussianBlur")
    .attr("stdDeviation", "4")
    .attr("result", "coloredBlur");

  svg.select("filter").append("feMerge");
  const feMerge = svg.select("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  const prevSceneButton = document.querySelector("button.previous-scene");
  const nextSceneButton = document.querySelector("button.next-scene");

  prevSceneButton.addEventListener("click", prevGitTag);
  nextSceneButton.addEventListener("click", nextGitTag);

  if (params.gitTagIndex === 0)
    prevSceneButton.setAttribute("disabled", "true");
  if (params.gitTagIndex === data.length - 1)
    prevSceneButton.setAttribute("disabled", "true");

  const playTimelineButton = document.querySelector("button.play-timeline");
  playTimelineButton.addEventListener("click", playTagTimeline);

  function prevGitTag() {
    params.gitTagIndex -= 0;
    drawGitRepoViz();
  }

  function nextGitTag() {
    params.gitTagIndex += 1;
    drawGitRepoViz();
  }

  function playTagTimeline(stopAtIndex) {
    data.slice(params.gitTagIndex).forEach(() =>
      setTimeout(() => {
        if (stopAtIndex && params.gitTagIndex === stopAtIndex) return;
        params.gitTagIndex += 1;
        timelineInput.value = params.gitTagIndex;
        drawGitRepoViz();
      }, 2000)
    );
  }

  const timelineInput = document.querySelector("input.timeline");
  const timelineDatalist = document.querySelector("#tag-markers");
  timelineInput.style.width = `${data.length * 10}px`;
  timelineDatalist.style.width = `${data.length * 10}px`;

  data.forEach((d, index) => {
    const value = index;
    const option = document.createElement("option");
    option.value = value;
    timelineDatalist.appendChild(option);
  });

  timelineInput.max = data.length;
  timelineInput.addEventListener("input", (event) => {
    params.gitTagIndex = event.target.value;
    drawGitRepoViz();
  });

  const minCircleRadiusInput = document.querySelector(
    "input.min-circle-radius"
  );

  minCircleRadiusInput.addEventListener("input", (event) => {
    const radius = Number(event.target.value);
    params.minCircleRadius = radius;
    drawGitRepoViz();
  });

  drawGitRepoViz();
  messagingTourStepper(state.tourStep)

  function lastCommitAccessor(d) {
    return new Date(d.commits?.[0]?.date + "0");
  }

  function numberOfCommitsAccessor(d) {
    return d?.commits?.length || 0;
  }

  function getColorSettings() {
    if (!data) return { colorScale: () => {}, colorExtent: [0, 0] };

    const flattenTree = (d) => {
      return d.children ? flatten(d.children.map(flattenTree)) : d;
    };

    const items = flattenTree(data);
    const flatTree =
      colorEncoding === "last-change"
        ? items
            .map(lastCommitAccessor)
            .sort((a, b) => b - a)
            .slice(0, -8)
        : items
            .map(numberOfCommitsAccessor)
            .sort((a, b) => b - a)
            .slice(2, -2);
    const colorExtent = d3.extent(flatTree);

    const colors = [
      "#f4f4f4",
      "#f4f4f4",
      "#f4f4f4",
      colorEncoding === "last-change" ? "#c7ecee" : "#feeaa7",
      colorEncoding === "number-of-changes" ? "#3c40c6" : "#823471",
    ];

    const colorScale = scaleLinear()
      .domain(
        range(0, colors.length).map(
          (i) =>
            +colorExtent[0] +
            ((colorExtent[1] - colorExtent[0]) * i) / (colors.length - 1)
        )
      )
      .range(colors)
      .clamp(true);

    return { colorScale, colorExtent };
  }

  function getColor(d) {
    if (colorEncoding === "type") {
      const isParent = d.children;
      if (isParent) {
        const extensions = countBy(d.children, (c) => c.extension);
        const mainExtension = maxBy(entries(extensions), ([_k, v]) => v)?.[0];
        return fileExtColors[mainExtension] || "#ced6e0";
      }
      return fileExtColors[d.extension] || "#ced6e0";
    } else if (colorEncoding === "number-of-changes") {
      return colorScale(numberOfCommitsAccessor(d)) || "#f4f4f4";
    } else if (colorEncoding === "last-change") {
      return colorScale(lastCommitAccessor(d)) || "#f4f4f4";
    }
  }

  function getPackedData(data) {
    if (!data) return [];

    const hierarchicalData = d3
      .hierarchy(processChild(data, getColor, cachedOrders, 0, fileExtColors))
      .sum((d) => d.value)
      .sort((a, b) => {
        return (
          b.data.sortOrder - a.data.sortOrder ||
          (b.data.name > a.data.name ? 1 : -1)
        );
      });

    let packedTree = d3
      .pack()
      .size([WIDTH, HEIGHT * 1.3])
      .padding((d) => {
        if (d.depth <= 0) return 0;

        const hasChildWithNoChildren =
          d.children.filter((d) => !d.children?.length).length > 1;

        if (hasChildWithNoChildren) return 20;
        return 10;
      })(hierarchicalData);

    packedTree.children = reflowSiblings(
      packedTree.children,
      cachedPositions,
      maxDepth
    );

    const children = packedTree.descendants();

    cachedOrders = {};
    cachedPositions = {};

    const saveCachedPositionForItem = (item) => {
      cachedOrders[item.data.path] = item.data.sortOrder;
      if (item.children) {
        item.children.forEach(saveCachedPositionForItem);
      }
    };

    saveCachedPositionForItem(packedTree);

    children.forEach((d) => {
      cachedPositions[d.data.path] = [d.x, d.y];
    });

    return children.slice(0, maxChildren);
  }

  function messagingTourStepper(step) {
    switch (step) {
      case 1: {
        const makeAnnotations = d3
          .annotation()
          .type(d3.annotationLabel)
          .textWrap(500)
          .annotations(messagingSteps[1].annotation);

        d3.select("svg#messaging-viz").append("g").call(makeAnnotations);
        state.tourStep += 1;

        break;
      }

      case 2: {
        const messagingSvg = d3.select("svg#messaging-viz");
        messagingSvg.html("");

        const annotations = [
          {
            note: {
              label: messagingText[2].label,
              bgPadding: 20,
            },
            className: "show-annotation-bg",
            x: 900,
            y: 130,
            dx: -200,
            dy: 200,
          },
        ];

        const makeAnnotations = d3
          .annotation()
          .type(d3.annotationCallout)
          .textWrap(600)
          .annotations(annotations);

        messagingSvg.append("g").call(makeAnnotations);
        state.tourStep += 1;

        setTimeout(() => nextGitTag(), 2000);
        break;
      }

      case 3: {
        const messagingSvg = d3.select("svg#messaging-viz");
        messagingSvg.html("");

        const annotations = [
          {
            note: {
              label: messagingText[3].label,
              bgPadding: 20,
            },
            className: "show-annotation-bg",
            x: 900,
            y: 130,
            dx: -200,
            dy: 200,
          },
        ];

        const makeAnnotations = d3
          .annotation()
          .type(d3.annotationCallout)
          .textWrap(600)
          .annotations(annotations);

        messagingSvg.append("g").call(makeAnnotations);
        state.tourStep += 1;

        playTagTimeline(10);
        break;
      }

      case 4: {
        const messagingSvg = d3.select("svg#messaging-viz");
        messagingSvg.html("");

        const annotations = [
          {
            note: {
              label: messagingText[4].label,
              bgPadding: 20,
            },
            className: "show-annotation-bg",
            x: 900,
            y: 130,
            dx: -200,
            dy: 200,
          },
        ];

        const makeAnnotations = d3
          .annotation()
          .type(d3.annotationCallout)
          .textWrap(600)
          .annotations(annotations);

        messagingSvg.append("g").call(makeAnnotations);
        state.tourStep = 'done';

        setTimeout(() => {
          params.minCircleRadius += 1;
          minCircleRadiusInput.value = params.minCircleRadius;
          drawGitRepoViz();

          setTimeout(() => {
            params.minCircleRadius += 1;
            minCircleRadiusInput.value = params.minCircleRadius;
            drawGitRepoViz();
          }, 1000)
        }, 1000)
        break;
      }

      case 'done': {
        state.isIntroMessagingComplete = true;
        params.gitTagIndex = 0;
        params.minCircleRadius = 15;
        drawGitRepoViz();
        break;
      }
    }
  }

  function drawGitRepoViz() {
    const gitData = data[params.gitTagIndex];
    if (!gitData) return;

    if (!state.isIntroMessagingComplete) {
      document.body.classList.add("intro-messaging");
    } else {
      const messagingOverlay = document.querySelector('#messaging-overlay')
      if (messagingOverlay) {
        messagingOverlay.remove();
      }
    }

    const gitTagHeader = document.querySelector(".git-tag-header");
    const currentTag = gitData.tag_name;
    gitTagHeader.textContent = `d3-shape@${currentTag}`;

    const [existingVizScene] = d3.select("#viz-scene");
    if (existingVizScene) {
      existingVizScene.remove();
    }

    const transformedData = transformGitTree(gitData);
    const packedData = getPackedData(transformedData);

    const vizScene = svg.append("g").attr("id", "viz-scene");

    

    recursiveCircles(packedData);
    recursiveDirLabel(packedData);
    recursiveFileLabel(packedData);

    function recursiveCircles(packedData, root = vizScene) {
      packedData.forEach(({ x, y, r, depth, data, children, path, color }) => {
        if (depth <= 0) return null;
        if (depth > maxDepth) return null;

        const isParent = !!children;
        let runningR = r;

        const _path = data?.path || path;
        const _color = data?.color || color;

        if (path === STRUCTURE_LOOSE_FILE) return null;

        const isHighlighted = filesChanged.includes(_path);

        const group = root
          .append("g")
          .attr("transform", `translate(${x}, ${y})`)
          .style("fill", _color)
          .style(
            "transition",
            `transform ${
              isHighlighted ? "0.5s" : "0s"
            } ease-out, fill 0.1s ease-out`
          );

        if (isParent) {
          group
            .append("circle")
            .attr("r", r)
            .attr("height", runningR)
            .attr("width", runningR)
            .attr("stroke", "#290819")
            .attr("stroke-opacity", "0.3")
            .attr("stroke-width", "1")
            .attr("fill", "#f4f4f4")
            .style("transition", "all 0.5s ease-out")
            .style("opacity", 0.5);

          if (children) {
            const nextRoot = group.select("circle");
            recursiveCircles(children, nextRoot);
          }
        } else {
          group
            .append("circle")
            .attr("r", runningR)
            .style("filter", isHighlighted ? "url(#glow)" : undefined)
            .style("transition", "all 0.5s ease-out")
            .attr("stroke-width", selectedNodeId === _path ? "3" : "1")
            .attr("stroke", "#374151")
            .style("opacity", 0.8);
        }
      });
    }

    function recursiveDirLabel(packedData, root = vizScene) {
      packedData.forEach(({ x, y, r, depth, data, children, path, label }) => {
        if (depth <= 0) return;
        if (depth > maxDepth) return;

        const isParent = !!children && depth !== maxDepth;
        let runningR = r;

        if (!isParent) return;

        const _path = data?.path || path;
        const _label = data?.label || label;

        if (_path === STRUCTURE_LOOSE_FILE) return;

        if (_label.length > r * 0.5) return;

        const labelText = truncateString(
          _label,
          r < 30 ? Math.floor(r / 2.7) + 3 : 100
        );

        const fontSize = Math.max(Math.floor(r / 5), 20);

        const group = root
          .append("g")
          .attr("transform", `translate(${x}, ${y})`)
          .style("pointer-events", "none")
          .style("transition", "all 0.5s ease-out");

        group
          .append("text")
          .attr("x", 0)
          .attr("y", 0)
          .attr("dy", ".35em")
          .attr("text-anchor", "middle")
          .style("font-size", `${fontSize}px`)
          .style("font-weight", 700)
          .style("fill", "#1f6b32")
          .style("opacity", 0.7)
          .style("transition", "all 0.5s ease-out")
          .text(`${labelText}/`);

        group
          .append("text")
          .attr("x", 0)
          .attr("y", 0)
          .attr("dy", "3em")
          .attr("text-anchor", "middle")
          .style("font-size", "14px")
          .style("fill", "#1f6b32")
          .style("opacity", 0.7)
          .style("transition", "all 0.5s ease-out")
          .text(`${Math.floor(runningR)} KB`);

        if (isParent) {
          const nextRoot = root.select("circle");
          recursiveDirLabel(children, nextRoot);
        }
      });
    }

    function recursiveFileLabel(packedData, root = vizScene) {
      packedData.forEach(({ x, y, r, depth, data, children }) => {
        if (depth <= 0) return;
        if (depth > maxDepth) return;
        const isParent = !!children;
        if (isParent) return;
        if (data.path === STRUCTURE_LOOSE_FILE) return;
        const isHighlighted = filesChanged.includes(data.path);
        const doHighlight = !!filesChanged.length;

        if (selectedNodeId === data.path && !isHighlighted) return;

        if (r < params.minCircleRadius) return;

        const labelText = isHighlighted
          ? data.label
          : truncateString(data.label, Math.floor(r / 4) + 3);

        const group = root
          .append("g")
          .attr("transform", `translate(${x}, ${y})`)
          .style("fill", data.color)
          .style(
            "transition",
            `transform ${isHighlighted ? "0.5s" : "0s"} ease-out`
          );

        group
          .append("text")
          .style("pointer-events", "none")
          .style("opacity", 0.9)
          .style("font-size", "14px")
          .style("font-weight", 500)
          .style("transition", "all 0.5s ease-out")
          .attr("fill", "#4b5563")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", "3")
          .attr("stroke-linejoin", "round")
          .text(labelText);

        group
          .append("text")
          .style("pointer-events", "none")
          .style("opacity", 1)
          .style("font-size", "14px")
          .style("font-weight", 500)
          .style("transition", "all 0.5s ease-out")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .text(labelText);

        group
          .append("text")
          .style("pointer-events", "none")
          .style("opacity", 0.5)
          .style("font-size", "14px")
          .style("font-weight", 500)
          .style("mix-blend-mode", "color-burn")
          .style("transition", "all 0.5s ease-out")
          .attr("fill", "#110101")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .text(labelText);
      });
    }
  }
}

function transformGitTree(gitTree) {
  const transformNode = (node) => {
    const { path, type, size } = node;

    const newNode = {
      name: path.split("/").filter(Boolean).slice(-1)[0],
      path,
      size: type === "blob" ? size : 0,
    };

    if (type === "tree") {
      newNode.children = [];
      gitTree.tree.forEach((child) => {
        const doTransform = child.path.startsWith(path + "/");
        if (doTransform) {
          newNode.children.push(transformNode(child));
        }
      });
    }

    return newNode;
  };

  const rootNode = {
    path: "",
    size: 0,
    children: [],
  };

  gitTree.tree.forEach((node) => {
    if (!node.path.includes("/")) {
      rootNode.children.push(transformNode(node));
    }
  });

  return rootNode;
}

function processChild(child, getColor, cachedOrders, i = 0, fileExtColors) {
  if (!child) return;

  const isRoot = !child.path;
  let name = child.name;
  let path = child.path;
  let children = child?.children?.map((c, i) =>
    processChild(c, getColor, cachedOrders, i, fileExtColors)
  );

  if (children?.length === 1) {
    name = `${name}/${children[0].name}`;
    path = children[0].path;
    children = children[0].children;
  }

  const pathWithoutExtension = path?.split(".").slice(0, -1).join(".");
  const extension = name?.split(".").slice(-1)[0];
  const hasExtension = !!fileExtColors[extension];

  if (isRoot && children) {
    const looseChildren = children?.filter((d) => !d.children?.length);
    children = [
      ...children?.filter((d) => d.children?.length),
      {
        name: STRUCTURE_LOOSE_FILE,
        path: STRUCTURE_LOOSE_FILE,
        size: 0,
        children: looseChildren,
      },
    ];
  }

  let extendedChild = {
    ...child,
    name,
    path,
    label: name,
    extension,
    pathWithoutExtension,

    size:
      (["woff", "woff2", "ttf", "otf", "png", "jpg", "svg"].includes(extension)
        ? 100
        : Math.min(
            15000,
            hasExtension ? child.size : Math.min(child.size, 9000)
          )) + i,
    value:
      (["woff", "woff2", "ttf", "otf", "png", "jpg", "svg"].includes(extension)
        ? 100
        : Math.min(
            15000,
            hasExtension ? child.size : Math.min(child.size, 9000)
          )) + i,
    color: "#ffffff",
    children,
  };

  extendedChild.color = getColor(extendedChild);
  extendedChild.sortOrder = getSortOrder(extendedChild, cachedOrders, i);

  return extendedChild;
}

function reflowSiblings(
  siblings,
  cachedPositions,
  maxDepth,
  parentRadius,
  parentPosition
) {
  if (!siblings) return;

  let items = [
    ...siblings.map((d) => {
      return {
        ...d,
        x: cachedPositions[d.data.path]?.[0] || d.x,
        y: cachedPositions[d.data.path]?.[1] || d.y,
        originalX: d.x,
        originalY: d.y,
      };
    }),
  ];

  const paddingScale = d3
    .scaleSqrt()
    .domain([maxDepth, 1])
    .range([3, 8])
    .clamp(true);

  let simulation = d3
    .forceSimulation(items)
    .force(
      "centerX",
      d3.forceX(WIDTH / 2).strength(items[0].depth <= 2 ? 0.01 : 0)
    )
    .force(
      "centerY",
      d3.forceY(HEIGHT / 2).strength(items[0].depth <= 2 ? 0.01 : 0)
    )
    .force(
      "centerX2",
      d3.forceX(parentPosition?.[0]).strength(parentPosition ? 0.3 : 0)
    )
    .force(
      "centerY2",
      d3.forceY(parentPosition?.[1]).strength(parentPosition ? 0.8 : 0)
    )
    .force(
      "x",
      d3
        .forceX((d) => cachedPositions[d.data.path]?.[0] || WIDTH / 2)
        .strength((d) =>
          cachedPositions[d.data.path]?.[1] ? 0.5 : (WIDTH / HEIGHT) * 0.3
        )
    )
    .force(
      "y",
      d3
        .forceY((d) => cachedPositions[d.data.path]?.[1] || HEIGHT / 2)
        .strength((d) =>
          cachedPositions[d.data.path]?.[0] ? 0.5 : (HEIGHT / WIDTH) * 0.3
        )
    )
    .force(
      "collide",
      d3
        .forceCollide((d) =>
          d.children ? d.r + paddingScale(d.depth) : d.r + 1.6
        )
        .iterations(8)
        .strength(1)
    )
    .stop();

  for (let i = 0; i < 280; i++) {
    simulation.tick();
    items.forEach((d) => {
      d.x = keepBetween(d.r, d.x, WIDTH - d.r);
      d.y = keepBetween(d.r, d.y, HEIGHT - d.r);

      if (parentPosition && parentRadius) {
        const containedPosition = keepCircleInsideCircle(
          parentRadius,
          parentPosition,
          d.r,
          [d.x, d.y],
          !!d.children?.length
        );
        d.x = containedPosition[0];
        d.y = containedPosition[1];
      }
    });
  }

  function repositionChildren(d, xDiff, yDiff) {
    let newD = { ...d };
    newD.x += xDiff;
    newD.y += yDiff;

    if (newD.children) {
      newD.children = newD.children.map((c) =>
        repositionChildren(c, xDiff, yDiff)
      );
    }
    return newD;
  }

  for (const item of items) {
    const itemCachedPosition = cachedPositions[item.data.path] || [
      item.x,
      item.y,
    ];
    const itemPositionDiffFromCached = [
      item.x - itemCachedPosition[0],
      item.y - itemCachedPosition[1],
    ];

    if (item.children) {
      let repositionedCachedPositions = { ...cachedPositions };
      const itemReflowDiff = [item.x - item.originalX, item.y - item.originalY];

      item.children = item.children.map((child) =>
        repositionChildren(child, itemReflowDiff[0], itemReflowDiff[1])
      );
      if (item.children.length > 4) {
        if (item.depth > maxDepth) return;
        item.children.forEach((child) => {
          const childCachedPosition =
            repositionedCachedPositions[child.data.path];
          if (childCachedPosition) {
            repositionedCachedPositions[child.data.path] = [
              childCachedPosition[0] + itemPositionDiffFromCached[0],
              childCachedPosition[1] + itemPositionDiffFromCached[1],
            ];
          } else {
            repositionedCachedPositions[child.data.path] = [child.x, child.y];
          }
        });

        item.children = reflowSiblings(
          item.children,
          repositionedCachedPositions,
          maxDepth,
          item.r,
          [item.x, item.y]
        );
      }
    }
  }

  return items;
}

function getSortOrder(item, cachedOrders, i = 0) {
  if (cachedOrders[item.path]) return cachedOrders[item.path];
  if (cachedOrders[item.path?.split("/")?.slice(0, -1)?.join("/")]) {
    return -100000000;
  }
  if (item.name === "public") return -1000000;
  return item.value + -i;
}

function countBy(array, iteratee) {
  return array.reduce((result, value) => {
    const key = iteratee(value);
    if (result[key]) {
      result[key]++;
    } else {
      result[key] = 1;
    }
    return result;
  }, {});
}

function maxBy(array, iteratee) {
  if (!array || !array.length) return undefined;
  let maxElement = array[0];
  let maxValue = iteratee(maxElement);

  for (let i = 1; i < array.length; i++) {
    const value = iteratee(array[i]);
    if (value > maxValue) {
      maxValue = value;
      maxElement = array[i];
    }
  }

  return maxElement;
}

function entries(obj) {
  const ownProps = Object.keys(obj);
  let i = ownProps.length;
  const resArray = new Array(i);
  while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];
  return resArray;
}

function unique(array) {
  return array.filter((value, index, self) => self.indexOf(value) === index);
}

function flatten(array) {
  return array.reduce((flat, toFlatten) => {
    return flat.concat(
      Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten
    );
  }, []);
}

function keepBetween(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function keepCircleInsideCircle(
  parentR,
  parentPosition,
  childR,
  childPosition,
  isParent = false
) {
  const distance = Math.sqrt(
    Math.pow(parentPosition[0] - childPosition[0], 2) +
      Math.pow(parentPosition[1] - childPosition[1], 2)
  );
  const angle = getAngleFromPosition(
    childPosition[0] - parentPosition[0],
    childPosition[1] - parentPosition[1]
  );

  const padding = Math.min(
    angle < -20 && angle > -100 && isParent ? 13 : 3,
    parentR * 0.2
  );

  if (distance > parentR - childR - padding) {
    const diff = getPositionFromAngleAndDistance(
      angle,
      parentR - childR - padding
    );
    return [parentPosition[0] + diff[0], parentPosition[1] + diff[1]];
  }

  return childPosition;
}

function getAngleFromPosition(x, y) {
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function getPositionFromAngleAndDistance(angle, distance) {
  const radians = (angle / 180) * Math.PI;
  return [Math.cos(radians) * distance, Math.sin(radians) * distance];
}

function truncateString(string = "", length = 20) {
  return string.length > length + 3
    ? string.substring(0, length) + "..."
    : string;
}
