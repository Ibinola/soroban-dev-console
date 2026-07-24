"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useContractStore } from "@/store/useContractStore";
import { useSavedCallsStore } from "@/store/useSavedCallsStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { Network, MousePointerClick, RotateCcw } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  network: string;
  callCount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  fnName: string;
  callCount: number;
}

function buildGraphData(
  contracts: Array<{ id: string; name: string; network: string }>,
  savedCalls: Array<{ contractId: string; fnName: string }>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const contractMap = new Map(contracts.map((c) => [c.id, c]));
  const edgeMap = new Map<string, GraphEdge>();
  const callCounts = new Map<string, number>();

  for (const call of savedCalls) {
    callCounts.set(call.contractId, (callCounts.get(call.contractId) || 0) + 1);
  }

  const nodes: GraphNode[] = contracts.map((c, i) => {
    const angle = (2 * Math.PI * i) / contracts.length;
    const radius = 150;
    return {
      id: c.id,
      label: c.name || c.id.slice(0, 8) + "...",
      network: c.network,
      callCount: callCounts.get(c.id) || 0,
      x: 300 + radius * Math.cos(angle),
      y: 250 + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    };
  });

  const edges: GraphEdge[] = [];
  for (const call of savedCalls) {
    const targetContract = contractMap.get(call.contractId);
    if (!targetContract) continue;

    for (const other of contracts) {
      if (other.id === call.contractId) continue;
      const key = `${other.id}->${call.contractId}:${call.fnName}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.callCount++;
      } else {
        edges.push({
          source: other.id,
          target: call.contractId,
          fnName: call.fnName,
          callCount: 1,
        });
        edgeMap.set(key, edges[edges.length - 1]);
      }
    }
  }

  return { nodes, edges };
}

function applyForces(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): GraphNode[] {
  const iterations = 100;
  const repulsion = 5000;
  const attraction = 0.005;
  const damping = 0.9;
  const centerForce = 0.01;

  for (let iter = 0; iter < iterations; iter++) {
    for (const node of nodes) {
      node.vx = 0;
      node.vy = 0;
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    for (const edge of edges) {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * attraction;
      source.vx += (dx / dist) * force;
      source.vy += (dy / dist) * force;
      target.vx -= (dx / dist) * force;
      target.vy -= (dy / dist) * force;
    }

    for (const node of nodes) {
      node.vx += (width / 2 - node.x) * centerForce;
      node.vy += (height / 2 - node.y) * centerForce;
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
      node.x = Math.max(50, Math.min(width - 50, node.x));
      node.y = Math.max(50, Math.min(height - 50, node.y));
    }
  }

  return nodes;
}

interface DependencyGraphProps {
  className?: string;
}

export function DependencyGraph({ className }: DependencyGraphProps) {
  const { contracts } = useContractStore();
  const { savedCalls } = useSavedCallsStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });

  useEffect(() => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width || 600, height: rect.height || 500 });
    }
  }, []);

  const graphData = useMemo(
    () => buildGraphData(contracts, savedCalls),
    [contracts, savedCalls],
  );

  const positionedNodes = useMemo(
    () =>
      applyForces(
        graphData.nodes.map((n) => ({ ...n })),
        graphData.edges,
        dimensions.width,
        dimensions.height,
      ),
    [graphData.nodes, graphData.edges, dimensions],
  );

  const nodeMap = useMemo(
    () => new Map(positionedNodes.map((n) => [n.id, n])),
    [positionedNodes],
  );

  const handleNodeClick = useCallback((contractId: string) => {
    window.location.href = `/contracts/${contractId}`;
  }, []);

  const resetLayout = useCallback(() => {
    positionedNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / positionedNodes.length;
      const radius = 150;
      node.x = dimensions.width / 2 + radius * Math.cos(angle);
      node.y = dimensions.height / 2 + radius * Math.sin(angle);
    });
  }, [positionedNodes, dimensions]);

  if (contracts.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">
            No contracts in workspace. Add contracts to see dependency graph.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="h-5 w-5" />
          Contract Dependency Graph
          <Badge variant="secondary">{positionedNodes.length} contracts</Badge>
        </CardTitle>
        <CardDescription>
          Inter-contract call relationships derived from saved calls. Click a
          node to navigate to that contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetLayout}
            className="gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Layout
          </Button>
          <span className="text-xs text-muted-foreground">
            {graphData.edges.length} connections
          </span>
        </div>

        <div className="relative rounded-md border bg-background overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="w-full h-[500px]"
            role="img"
            aria-label="Contract dependency graph showing inter-contract call relationships"
          >
            <title>Contract Dependency Graph</title>
            <desc>
              A visualization of contracts and their call relationships. Each
              node represents a contract, and edges represent function calls
              between contracts.
            </desc>

            {graphData.edges.map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) return null;
              const isHighlighted =
                hoveredNode === edge.source || hoveredNode === edge.target;
              return (
                <g key={`${edge.source}-${edge.target}-${edge.fnName}`}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={isHighlighted ? "#3b82f6" : "#94a3b8"}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeDasharray={isHighlighted ? "none" : "4 2"}
                    markerEnd="url(#arrowhead)"
                  />
                  <text
                    x={(source.x + target.x) / 2}
                    y={(source.y + target.y) / 2 - 5}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[8px]"
                  >
                    {edge.fnName}
                  </text>
                </g>
              );
            })}

            {positionedNodes.map((node) => {
              const isHovered = hoveredNode === node.id;
              const radius = Math.max(
                16,
                Math.min(30, 16 + node.callCount * 2),
              );
              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleNodeClick(node.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Contract ${node.label}, ${node.callCount} calls. Click to view details.`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleNodeClick(node.id);
                    }
                  }}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill={isHovered ? "#3b82f6" : "#6366f1"}
                    stroke={isHovered ? "#1d4ed8" : "#4f46e5"}
                    strokeWidth={2}
                    className="transition-colors"
                  />
                  <text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white text-[10px] font-medium pointer-events-none"
                  >
                    {node.label.length > 10
                      ? node.label.slice(0, 8) + "..."
                      : node.label}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + radius + 12}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[8px]"
                  >
                    {node.network}
                  </text>
                </g>
              );
            })}

            <defs>
              <marker
                id="arrowhead"
                viewBox="0 0 10 7"
                refX="10"
                refY="3.5"
                markerWidth="8"
                markerHeight="6"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
          </svg>
        </div>

        {/* Accessibility: table fallback for screen readers */}
        <div className="sr-only">
          <table>
            <caption>Contract Dependencies</caption>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Network</th>
                <th>Saved Calls</th>
                <th>Calls To</th>
              </tr>
            </thead>
            <tbody>
              {positionedNodes.map((node) => (
                <tr key={node.id}>
                  <td>{node.label}</td>
                  <td>{node.network}</td>
                  <td>{node.callCount}</td>
                  <td>
                    {graphData.edges
                      .filter((e) => e.source === node.id)
                      .map((e) => {
                        const target = positionedNodes.find(
                          (n) => n.id === e.target,
                        );
                        return `${target?.label || e.target} (${e.fnName})`;
                      })
                      .join(", ") || "None"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Visual legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-indigo-500" />
            <span>Contract node</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="24" height="12">
              <line
                x1="0"
                y1="6"
                x2="20"
                y2="6"
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="4 2"
              />
            </svg>
            <span>Call relationship</span>
          </div>
          <div className="flex items-center gap-1">
            <MousePointerClick className="h-3 w-3" />
            <span>Click node to navigate</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
