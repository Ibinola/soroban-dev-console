"use client";

import { useEffect, useState } from "react";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { useNetworkStore } from "@/store/useNetworkStore";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

interface ContractEventsProps {
  contractId: string;
}

interface EventRecord {
  id: string;
  type: string;
  topic: any[]; // Decoded or raw
  data: string;
  ledger: number;
  ts: string;
}

export function ContractEvents({ contractId }: ContractEventsProps) {
  const { getActiveNetworkConfig } = useNetworkStore();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchEvents() {
      try {
        const network = getActiveNetworkConfig();
        const server = new SorobanRpc.Server(network.rpcUrl);

        // Fetch last 100 events for this contract
        const response = await server.getEvents({
          startLedger: 0, // In prod, calculate "now - 10000 ledgers"
          filters: [
            {
              type: "contract",
              contractIds: [contractId],
            },
          ],
          limit: 20,
        });

        const formatted = response.events.map((evt) => ({
          id: evt.id,
          type: evt.type, // e.g., 'system', 'contract', 'diagnostic'
          // Topics in RPC are array of base64 XDR.
          // For simple display, we just show "X topics" or raw strings if possible.
          topic: evt.topic,
          data:
            typeof evt.value === "string"
              ? evt.value
              : JSON.stringify(evt.value),
          ledger: evt.ledger,
          ts: evt.ledgerClosedAt,
        }));

        setEvents(formatted);
      } catch (err: any) {
        console.error(err);
        setError("Failed to fetch events. Ensure the RPC supports getEvents.");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [contractId, getActiveNetworkConfig]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500 bg-red-50 rounded-md flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ledger</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Topics (Raw)</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No events found for this contract.
                </TableCell>
              </TableRow>
            ) : (
              events.map((evt) => (
                <TableRow key={evt.id}>
                  <TableCell className="font-mono text-xs">
                    {evt.ledger}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">
                      {evt.type}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs font-mono text-muted-foreground">
                    {evt.topic.join(", ")}
                  </TableCell>
                  <TableCell className="text-right max-w-[200px] truncate text-xs font-mono">
                    {/* Data is usually XDR base64, truncated for UI */}
                    {evt.data.slice(0, 20)}...
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
