import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Map, Building, ScrollText } from "lucide-react";

export default function KingdomPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kingdom</h1>
          <p className="text-muted-foreground">Kingdom management and hex grid</p>
        </div>
        <Badge variant="outline" className="text-sm">
          Phase 5
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kingdom Stats</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Culture, Economy, Loyalty, Stability
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hex Grid</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Explore, claim, and develop hexes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Settlements</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Build structures and grow your towns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kingdom Turns</CardTitle>
            <ScrollText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Track turn phases and activities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kingdom placeholder */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>The Stolen Lands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-md border border-dashed bg-muted/50">
            <div className="text-center">
              <Crown className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Kingdom Management</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                The full kingdom building system — hex grid, settlements, structures,
                resources, leadership roles, and turn tracker — will be implemented in Phase 5.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                The database schema is already designed and ready for this feature.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
