import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';
import { Button, Modal, Input, Select, Badge, EmptyState } from '@/components/ui';

interface Table {
  id: string;
  label: string;
  minSeats: number;
  maxSeats: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  shape: string;
  isVip: boolean;
  isCombinable: boolean;
  joinGroup: string | null;
  isActive: boolean;
}

interface FloorPlan {
  id: string;
  name: string;
  tables: Table[];
}

interface Adjacency {
  tableAId: string;
  tableBId: string;
  canJoin: boolean;
  joinMaxSeats: number | null;
}

export function FloorPlanPage() {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [adjacency, setAdjacency] = useState<Adjacency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', minSeats: '2', maxSeats: '4', shape: 'square', isVip: false, isCombinable: false, joinGroup: '' });
  const [addLoading, setAddLoading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const fetchFloorPlans = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: FloorPlan[] }>('/api/v1/floor-plans');
      setFloorPlans(res.data);
      if (res.data.length > 0 && !activePlan) {
        setActivePlan(res.data[0].id);
        // Fetch with adjacency
        const detail = await apiFetch<{ data: FloorPlan & { adjacency: Adjacency[] } }>(`/api/v1/floor-plans/${res.data[0].id}`);
        setAdjacency(detail.data.adjacency || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFloorPlans(); }, []);

  const switchPlan = async (id: string) => {
    setActivePlan(id);
    try {
      const detail = await apiFetch<{ data: FloorPlan & { adjacency: Adjacency[] } }>(`/api/v1/floor-plans/${id}`);
      setAdjacency(detail.data.adjacency || []);
    } catch (err) { console.error(err); }
  };

  const currentPlan = floorPlans.find(p => p.id === activePlan);
  const tables = currentPlan?.tables || [];

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent, table: Table) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({ id: table.id, startX: e.clientX, startY: e.clientY, origX: table.positionX, origY: table.positionY });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    setFloorPlans(prev => prev.map(fp => ({
      ...fp,
      tables: fp.tables.map(t =>
        t.id === dragging.id
          ? { ...t, positionX: Math.max(0, dragging.origX + dx), positionY: Math.max(0, dragging.origY + dy) }
          : t
      ),
    })));
  }, [dragging]);

  const handleMouseUp = useCallback(async () => {
    if (!dragging || !activePlan) return;
    const table = tables.find(t => t.id === dragging.id);
    if (table) {
      try {
        await apiFetch(`/api/v1/floor-plans/${activePlan}/tables/batch`, {
          method: 'PUT',
          body: JSON.stringify({ tables: [{ id: table.id, positionX: table.positionX, positionY: table.positionY }] }),
        });
      } catch (err) { console.error(err); }
    }
    setDragging(null);
  }, [dragging, activePlan, tables]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);

  // Add table
  const addTable = async () => {
    if (!addForm.label.trim() || !activePlan) return;
    setAddLoading(true);
    try {
      await apiFetch(`/api/v1/floor-plans/${activePlan}/tables`, {
        method: 'POST',
        body: JSON.stringify({
          floorPlanId: activePlan,
          label: addForm.label,
          minSeats: parseInt(addForm.minSeats),
          maxSeats: parseInt(addForm.maxSeats),
          shape: addForm.shape,
          isVip: addForm.isVip,
          isCombinable: addForm.isCombinable,
          joinGroup: addForm.joinGroup || null,
          positionX: 50 + Math.random() * 400,
          positionY: 50 + Math.random() * 300,
          width: 80,
          height: 80,
        }),
      });
      setAddOpen(false);
      setAddForm({ label: '', minSeats: '2', maxSeats: '4', shape: 'square', isVip: false, isCombinable: false, joinGroup: '' });
      fetchFloorPlans();
    } catch (err: any) { alert(err.message); }
    finally { setAddLoading(false); }
  };

  // Table shape renderer
  const getTableStyle = (t: Table): React.CSSProperties => ({
    position: 'absolute',
    left: t.positionX,
    top: t.positionY,
    width: t.width,
    height: t.height,
    borderRadius: t.shape === 'round' ? '50%' : t.shape === 'rectangle' ? '12px' : '12px',
    cursor: dragging?.id === t.id ? 'grabbing' : 'grab',
    transition: dragging?.id === t.id ? 'none' : 'box-shadow 0.15s',
  });

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Tloris</h1>
          <p className="text-sm text-gray-500 mt-0.5">Povlecite mize za premikanje, kliknite za urejanje</p>
        </div>
        <div className="flex items-center gap-2">
          {activePlan && <Button onClick={() => setAddOpen(true)}>+ Dodaj mizo</Button>}
        </div>
      </div>

      {/* Floor plan tabs */}
      {floorPlans.length > 0 && (
        <div className="flex gap-1 mb-4 flex-shrink-0">
          {floorPlans.map(fp => (
            <button
              key={fp.id}
              onClick={() => switchPlan(fp.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activePlan === fp.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {fp.name} <span className="text-xs opacity-60">({fp.tables.length})</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex-1 bg-gray-100 rounded-xl animate-pulse" />
      ) : !currentPlan ? (
        <EmptyState icon="🗺️" title="Ni tlorisov" description="Ustvarite prvi tloris za vašo restavracijo" />
      ) : (
        /* Canvas */
        <div
          ref={canvasRef}
          className="flex-1 bg-[#f8f9fb] rounded-xl border-2 border-dashed border-gray-200 relative overflow-hidden min-h-[500px]"
          style={{ backgroundImage: 'radial-gradient(circle, #ddd 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        >
          {/* Adjacency lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {adjacency.filter(a => a.canJoin).map((adj, i) => {
              const tA = tables.find(t => t.id === adj.tableAId);
              const tB = tables.find(t => t.id === adj.tableBId);
              if (!tA || !tB) return null;
              return (
                <line
                  key={i}
                  x1={tA.positionX + tA.width / 2}
                  y1={tA.positionY + tA.height / 2}
                  x2={tB.positionX + tB.width / 2}
                  y2={tB.positionY + tB.height / 2}
                  stroke="#86efac"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  opacity="0.6"
                />
              );
            })}
          </svg>

          {/* Tables */}
          {tables.map(table => (
            <div
              key={table.id}
              style={getTableStyle(table)}
              onMouseDown={e => handleMouseDown(e, table)}
              onClick={e => { if (!dragging) { e.stopPropagation(); setSelectedTable(table); setEditOpen(true); } }}
              className={`
                flex flex-col items-center justify-center border-2 select-none z-10
                ${selectedTable?.id === table.id ? 'border-brand-500 shadow-lg shadow-brand-200/50' : 'border-gray-300'}
                ${table.isVip ? 'bg-amber-50 border-amber-400' : 'bg-white'}
                hover:shadow-md hover:border-gray-400
              `}
            >
              <span className="text-xs font-bold text-gray-800">{table.label}</span>
              <span className="text-[10px] text-gray-400">{table.minSeats}-{table.maxSeats}</span>
              {table.isVip && <span className="text-[9px] text-amber-600 font-semibold">VIP</span>}
            </div>
          ))}

          {tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-2">Tloris je prazen</p>
                <Button size="sm" onClick={() => setAddOpen(true)}>+ Dodaj prvo mizo</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit table modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Miza ${selectedTable?.label || ''}`}>
        {selectedTable && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Kapaciteta</p>
                <p className="text-sm font-medium">{selectedTable.minSeats} - {selectedTable.maxSeats} sedežev</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Oblika</p>
                <p className="text-sm font-medium capitalize">{selectedTable.shape}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {selectedTable.isVip && <Badge variant="warning">VIP</Badge>}
              {selectedTable.isCombinable && <Badge variant="info">Združljiva</Badge>}
              {selectedTable.joinGroup && <Badge variant="default">Skupina: {selectedTable.joinGroup}</Badge>}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditOpen(false)} className="flex-1">Zapri</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add table modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Nova miza">
        <div className="space-y-4">
          <Input label="Oznaka *" value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} placeholder="npr. T1, Terasa 3" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min. sedežev" type="number" value={addForm.minSeats} onChange={e => setAddForm(f => ({ ...f, minSeats: e.target.value }))} />
            <Input label="Max. sedežev" type="number" value={addForm.maxSeats} onChange={e => setAddForm(f => ({ ...f, maxSeats: e.target.value }))} />
          </div>
          <Select
            label="Oblika"
            value={addForm.shape}
            onChange={e => setAddForm(f => ({ ...f, shape: e.target.value }))}
            options={[
              { value: 'square', label: 'Kvadrat' },
              { value: 'round', label: 'Okrogla' },
              { value: 'rectangle', label: 'Pravokotnik' },
            ]}
          />
          <Input label="Združevalna skupina" value={addForm.joinGroup} onChange={e => setAddForm(f => ({ ...f, joinGroup: e.target.value }))} placeholder="npr. main-A (neobvezno)" />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addForm.isVip} onChange={e => setAddForm(f => ({ ...f, isVip: e.target.checked }))} className="w-4 h-4 rounded" />
              VIP miza
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addForm.isCombinable} onChange={e => setAddForm(f => ({ ...f, isCombinable: e.target.checked }))} className="w-4 h-4 rounded" />
              Združljiva
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)} className="flex-1">Prekliči</Button>
            <Button onClick={addTable} loading={addLoading} className="flex-[2]">Dodaj mizo</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
