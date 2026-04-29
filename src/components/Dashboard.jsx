import React, { useState, useEffect } from "react";
import { 
  Inbox, 
  ShieldAlert, 
  Trash2, 
  BrainCircuit, 
  Sparkles, 
  Tags 
} from "lucide-react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from "./ui/card";

export default function Dashboard() {
  const [stats, setStats] = useState({ inbox: 0, junk: 0, trash: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard Stats Error:", err);
        setLoading(false);
      });
  }, []);

  const MailboxStats = [
    {
      title: "Inbox",
      count: stats.inbox,
      icon: <Inbox className="h-4 w-4 text-zinc-500" />,
    },
    {
      title: "Junk Mail",
      count: stats.junk,
      icon: <ShieldAlert className="h-4 w-4 text-zinc-500" />,
    },
    {
      title: "Trash",
      count: stats.trash,
      icon: <Trash2 className="h-4 w-4 text-zinc-500" />,
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 bg-zinc-50/50 w-full overflow-y-auto">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        {MailboxStats.map((item, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {item.title}
              </CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? (
                  <div className="h-8 w-16 bg-zinc-200 animate-pulse rounded"></div>
                ) : (
                  item.count
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Total messages</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-6">
        <div className="flex items-center justify-between space-y-2 mb-4">
          <h3 className="text-xl font-semibold tracking-tight text-zinc-800">
            Intelligence Hub
          </h3>
          <span className="text-xs font-semibold bg-zinc-200 text-zinc-600 px-2 py-1 rounded-full uppercase">Coming soon</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-dashed border-zinc-300 bg-zinc-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                Ollama AI Model
              </CardTitle>
              <BrainCircuit className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-zinc-400 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-zinc-300"></span> Offline
              </div>
              <p className="text-xs text-zinc-400 mt-1">Awaiting local LLM connection</p>
            </CardContent>
          </Card>

          <Card className="border-dashed border-zinc-300 bg-zinc-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                Auto-Sorted Today
              </CardTitle>
              <Sparkles className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-400">
                0
              </div>
              <p className="text-xs text-zinc-400 mt-1">Ready for smarter routing</p>
            </CardContent>
          </Card>

          <Card className="border-dashed border-zinc-300 bg-zinc-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                Smart Tags Generated
              </CardTitle>
              <Tags className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-400">
                0
              </div>
              <p className="text-xs text-zinc-400 mt-1">Pending contextual tagging</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
