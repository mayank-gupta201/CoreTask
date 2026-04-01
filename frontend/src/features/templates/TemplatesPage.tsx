import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Play, Loader2, FileText, X } from 'lucide-react';
import { useState } from 'react';

interface TemplateItem {
    id?: string;
    title: string;
    description?: string;
    priority?: string;
    category?: string;
}

interface Template {
    id: string;
    name: string;
    description?: string;
    items?: TemplateItem[];
    createdAt: string;
}

export function TemplatesPage() {
    const queryClient = useQueryClient();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDescription, setNewTemplateDescription] = useState('');
    const [newItems, setNewItems] = useState<TemplateItem[]>([{ title: '', priority: 'MEDIUM' }]);

    const { data: templates, isLoading } = useQuery<Template[]>({
        queryKey: ['templates'],
        queryFn: async () => {
            const res = await api.get('/templates');
            return res.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: { name: string; description?: string; items: TemplateItem[] }) => {
            return api.post('/templates', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            setShowCreateForm(false);
            setNewTemplateName('');
            setNewTemplateDescription('');
            setNewItems([{ title: '', priority: 'MEDIUM' }]);
        },
    });

    const applyMutation = useMutation({
        mutationFn: async (templateId: string) => {
            return api.post(`/templates/apply/${templateId}`);
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            alert(`✅ Template applied! ${res.data.tasksCreated} tasks created.`);
        },
        onError: () => {
            alert('Failed to apply template.');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/templates/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
    });

    const handleAddItem = () => {
        setNewItems([...newItems, { title: '', priority: 'MEDIUM' }]);
    };

    const handleRemoveItem = (index: number) => {
        setNewItems(newItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof TemplateItem, value: string) => {
        const updated = [...newItems];
        updated[index] = { ...updated[index], [field]: value };
        setNewItems(updated);
    };

    const handleCreate = () => {
        if (!newTemplateName.trim()) return;
        const validItems = newItems.filter(i => i.title.trim());
        if (validItems.length === 0) return;
        createMutation.mutate({
            name: newTemplateName,
            description: newTemplateDescription || undefined,
            items: validItems,
        });
    };

    const selectClass = "flex h-9 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-smooth w-24";

    if (isLoading) {
        return <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">Loading templates...</div>;
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Create reusable task templates.</p>
                </div>
                <Button size="sm" className="h-9 text-[13px]" onClick={() => setShowCreateForm(!showCreateForm)}>
                    {showCreateForm ? <><X className="mr-1.5 h-3.5 w-3.5" /> Cancel</> : <><PlusCircle className="mr-1.5 h-3.5 w-3.5" /> New Template</>}
                </Button>
            </div>

            {/* Create form */}
            {showCreateForm && (
                <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
                    <h2 className="text-sm font-semibold">Create Template</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[13px] font-medium">Name <span className="text-destructive">*</span></Label>
                            <Input placeholder="e.g., Sprint Planning" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[13px] font-medium">Description</Label>
                            <Input placeholder="Optional description" value={newTemplateDescription} onChange={(e) => setNewTemplateDescription(e.target.value)} className="h-9" />
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <Label className="text-[13px] font-medium">Items <span className="text-destructive">*</span></Label>
                        {newItems.map((item, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <Input
                                    placeholder={`Task ${index + 1}`}
                                    value={item.title}
                                    onChange={(e) => handleItemChange(index, 'title', e.target.value)}
                                    className="flex-1 h-9"
                                />
                                <select
                                    className={selectClass}
                                    value={item.priority || 'MEDIUM'}
                                    onChange={(e) => handleItemChange(index, 'priority', e.target.value)}
                                >
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                    <option value="URGENT">Urgent</option>
                                </select>
                                <Input
                                    placeholder="Category"
                                    value={item.category || ''}
                                    onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                                    className="w-28 h-9"
                                />
                                {newItems.length > 1 && (
                                    <button className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-smooth shrink-0" onClick={() => handleRemoveItem(index)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 mt-1"
                            onClick={handleAddItem}
                        >
                            <PlusCircle className="h-3 w-3" /> Add item
                        </button>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" className="h-9" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                        <Button
                            size="sm"
                            className="h-9"
                            onClick={handleCreate}
                            disabled={!newTemplateName.trim() || newItems.filter(i => i.title.trim()).length === 0 || createMutation.isPending}
                        >
                            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                            Create
                        </Button>
                    </div>
                </div>
            )}

            {/* Templates grid */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {templates?.map((template) => (
                    <div key={template.id} className="rounded-xl border border-border/60 bg-card p-5 group transition-smooth hover:shadow-sm hover:border-border">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <FileText className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <h3 className="text-[13px] font-semibold">{template.name}</h3>
                            </div>
                            <button
                                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-smooth"
                                onClick={() => { if (confirm('Delete this template?')) deleteMutation.mutate(template.id); }}
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>

                        {template.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.description}</p>
                        )}

                        <div className="flex items-center justify-between mt-3">
                            <span className="text-[11px] text-muted-foreground">
                                {new Date(template.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] px-2.5 font-medium"
                                onClick={() => applyMutation.mutate(template.id)}
                                disabled={applyMutation.isPending}
                            >
                                {applyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                                Apply
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {templates?.length === 0 && !showCreateForm && (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/60 rounded-xl text-muted-foreground">
                    <FileText className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm font-medium">No templates yet</p>
                    <p className="text-xs mt-1">Create your first template to get started.</p>
                </div>
            )}
        </div>
    );
}
