import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    Stack,
    Button,
    IconButton,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { logger } from '../utils/logger';

const client = generateClient<Schema>();

interface Props {
    open: boolean;
    onClose: () => void;
    targetId: string;
    targetTitle: string;
    targetType: 'objective' | 'outcome' | 'kr' | 'initiative';
    organizationId: string;
    dependencies: Schema['Dependency']['type'][];
    onRefresh: () => Promise<void>;
}

export default function DependencyManagementDialog({
    open,
    onClose,
    targetId,
    targetTitle,
    targetType,
    organizationId,
    dependencies,
    onRefresh
}: Props) {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        description: '',
        owner: '',
        state: 'ACTIVE',
        status: 'ON_TRACK',
        dueDate: ''
    });

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (!open) {
            setIsCreating(false);
            setEditingId(null);
            resetForm();
        }
    }, [open]);

    const resetForm = () => {
        setFormData({
            description: '',
            owner: '',
            state: 'ACTIVE',
            status: 'ON_TRACK',
            dueDate: ''
        });
    };

    const handleCreate = async () => {
        if (!formData.description) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.models.Dependency as any).create({
                organizationId,
                description: formData.description,
                owner: formData.owner || undefined,
                state: formData.state,
                status: formData.status,
                dueDate: formData.dueDate || undefined,
                // Link to specific parent
                strategicObjectiveId: targetType === 'objective' ? targetId : undefined,
                outcomeId: targetType === 'outcome' ? targetId : undefined,
                keyResultId: targetType === 'kr' ? targetId : undefined,
                initiativeId: targetType === 'initiative' ? targetId : undefined,
            });
            await onRefresh();
            setIsCreating(false);
            resetForm();
        } catch (e) {
            logger.error("Failed to create dependency", e);
            alert("Failed to create dependency.");
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.models.Dependency as any).update({
                id,
                description: formData.description,
                owner: formData.owner || undefined,
                state: formData.state,
                status: formData.status,
                dueDate: formData.dueDate || undefined,
            });
            await onRefresh();
            setEditingId(null);
            resetForm();
        } catch (e) {
            logger.error("Failed to update dependency", e);
            alert("Failed to update dependency.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Delete this dependency?")) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.models.Dependency as any).delete({ id });
            await onRefresh();
        } catch (e) {
            logger.error("Failed to delete dependency", e);
            alert("Failed to delete dependency.");
        }
    };

    const startEdit = (dep: Schema['Dependency']['type']) => {
        setEditingId(dep.id);
        setFormData({
            description: dep.description,
            owner: dep.owner || '',
            state: dep.state || 'ACTIVE',
            status: dep.status || 'ON_TRACK',
            dueDate: dep.dueDate || ''
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                    <Typography variant="h6" component="div">
                        Manage Dependencies
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        For: {targetTitle}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Box mb={2}>
                    {!isCreating && !editingId && (
                        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setIsCreating(true)}>
                            Add Dependency
                        </Button>
                    )}
                </Box>

                {/* Create Form */}
                {isCreating && (
                    <Box p={2} bgcolor="grey.50" borderRadius={1} mb={2} border={1} borderColor="divider">
                        <Typography variant="subtitle2" gutterBottom>New Dependency</Typography>
                        <Stack spacing={2}>
                            <TextField
                                label="Description"
                                fullWidth
                                size="small"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="Owner"
                                    size="small"
                                    value={formData.owner}
                                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                />
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>State</InputLabel>
                                    <Select
                                        value={formData.state}
                                        label="State"
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                    >
                                        <MenuItem value="ACTIVE">Active</MenuItem>
                                        <MenuItem value="RESOLVED">Resolved</MenuItem>
                                        <MenuItem value="PLANNED">Planned</MenuItem>
                                        <MenuItem value="PAST_DUE">Past Due</MenuItem>
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        value={formData.status}
                                        label="Status"
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <MenuItem value="ON_TRACK">On Track</MenuItem>
                                        <MenuItem value="AT_RISK">At Risk</MenuItem>
                                        <MenuItem value="OFF_TRACK">Off Track</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Due Date"
                                    type="date"
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                />
                            </Stack>
                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                <Button onClick={() => setIsCreating(false)}>Cancel</Button>
                                <Button variant="contained" onClick={handleCreate} disabled={!formData.description}>Save</Button>
                            </Stack>
                        </Stack>
                    </Box>
                )}

                {/* List */}
                <Stack spacing={1}>
                    {dependencies.length === 0 && !isCreating ? (
                        <Typography color="text.secondary" fontStyle="italic" align="center" py={4}>No dependencies found.</Typography>
                    ) : (
                        dependencies.map(dep => {
                            const isEditing = editingId === dep.id;
                            if (isEditing) {
                                return (
                                    <Box key={dep.id} p={2} bgcolor="grey.50" borderRadius={1} border={1} borderColor="primary.main">
                                        <Stack spacing={2}>
                                            <TextField
                                                label="Description"
                                                fullWidth
                                                size="small"
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            />
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                                <TextField label="Owner" size="small" value={formData.owner} onChange={(e) => setFormData({ ...formData, owner: e.target.value })} />
                                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                                    <InputLabel>State</InputLabel>
                                                    <Select value={formData.state} label="State" onChange={(e) => setFormData({ ...formData, state: e.target.value })}>
                                                        <MenuItem value="ACTIVE">Active</MenuItem>
                                                        <MenuItem value="RESOLVED">Resolved</MenuItem>
                                                        <MenuItem value="PLANNED">Planned</MenuItem>
                                                        <MenuItem value="PAST_DUE">Past Due</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                                    <InputLabel>Status</InputLabel>
                                                    <Select value={formData.status} label="Status" onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                                                        <MenuItem value="ON_TRACK">On Track</MenuItem>
                                                        <MenuItem value="AT_RISK">At Risk</MenuItem>
                                                        <MenuItem value="OFF_TRACK">Off Track</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <TextField label="Due Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={formData.dueDate ? formData.dueDate.split('T')[0] : ''} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
                                            </Stack>
                                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                                <IconButton size="small" onClick={() => setEditingId(null)}><CloseIcon /></IconButton>
                                                <IconButton color="primary" size="small" onClick={() => handleUpdate(dep.id)}><SaveIcon /></IconButton>
                                            </Stack>
                                        </Stack>
                                    </Box>
                                );
                            }
                            return (
                                <Box key={dep.id} p={1.5} border={1} borderColor="divider" borderRadius={1} display="flex" justifyContent="space-between" alignItems="flex-start">
                                    <Box>
                                        <Typography variant="body2" fontWeight="500">{dep.description}</Typography>
                                        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                                            <Chip label={dep.state} size="small" color={dep.state === 'ACTIVE' ? 'primary' : 'default'} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                            <Chip label={dep.status} size="small" color={dep.status === 'ON_TRACK' ? 'success' : 'error'} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                            {dep.owner && <Chip label={`Owner: ${dep.owner}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                                            {dep.dueDate && <Chip label={`Due: ${new Date(dep.dueDate).toLocaleDateString()}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                                        </Stack>
                                    </Box>
                                    <Stack direction="row">
                                        <IconButton size="small" onClick={() => startEdit(dep)}><EditIcon fontSize="small" /></IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDelete(dep.id)}><DeleteIcon fontSize="small" /></IconButton>
                                    </Stack>
                                </Box>
                            );
                        })
                    )}
                </Stack>
            </DialogContent>
        </Dialog>
    );
}
