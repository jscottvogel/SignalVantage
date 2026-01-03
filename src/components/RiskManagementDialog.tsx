
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
    risks: Schema['Risk']['type'][];
    onRefresh: () => Promise<void>;
}

export default function RiskManagementDialog({
    open,
    onClose,
    targetId,
    targetTitle,
    targetType,
    organizationId,
    risks,
    onRefresh
}: Props) {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        description: '',
        impact: 'LOW' as Schema['Risk']['type']['impact'],
        probability: 50,
        roamStatus: 'OWNED' as Schema['Risk']['type']['roamStatus']
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
            impact: 'LOW',
            probability: 50,
            roamStatus: 'OWNED'
        });
    };

    const handleCreate = async () => {
        if (!formData.description) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.models.Risk as any).create({
                organizationId,
                description: formData.description,
                impact: formData.impact,
                probability: formData.probability,
                roamStatus: formData.roamStatus,
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
            logger.error("Failed to create risk", e);
            alert("Failed to create risk.");
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.models.Risk as any).update({
                id,
                description: formData.description,
                impact: formData.impact,
                probability: formData.probability,
                roamStatus: formData.roamStatus,
            });
            await onRefresh();
            setEditingId(null);
            resetForm();
        } catch (e) {
            logger.error("Failed to update risk", e);
            alert("Failed to update risk.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Delete this risk?")) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.models.Risk as any).delete({ id });
            await onRefresh();
        } catch (e) {
            logger.error("Failed to delete risk", e);
            alert("Failed to delete risk.");
        }
    };

    const startEdit = (risk: Schema['Risk']['type']) => {
        setEditingId(risk.id);
        setFormData({
            description: risk.description,
            impact: risk.impact || 'LOW',
            probability: risk.probability || 50,
            roamStatus: risk.roamStatus || 'OWNED'
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                    <Typography variant="h6" component="div">
                        Manage Risks
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
                            Add Risk
                        </Button>
                    )}
                </Box>

                {/* Create Form */}
                {isCreating && (
                    <Box p={2} bgcolor="grey.50" borderRadius={1} mb={2} border={1} borderColor="divider">
                        <Typography variant="subtitle2" gutterBottom>New Risk</Typography>
                        <Stack spacing={2}>
                            <TextField
                                label="Description"
                                fullWidth
                                size="small"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Impact</InputLabel>
                                    <Select
                                        value={formData.impact}
                                        label="Impact"
                                        onChange={(e) => setFormData({ ...formData, impact: e.target.value as Schema['Risk']['type']['impact'] })}
                                    >
                                        <MenuItem value="LOW">Low</MenuItem>
                                        <MenuItem value="MEDIUM">Medium</MenuItem>
                                        <MenuItem value="HIGH">High</MenuItem>
                                        <MenuItem value="CRITICAL">Critical</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Prob (%)"
                                    type="number"
                                    size="small"
                                    sx={{ width: 100 }}
                                    value={formData.probability}
                                    onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                                />
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>ROAM</InputLabel>
                                    <Select
                                        value={formData.roamStatus}
                                        label="ROAM"
                                        onChange={(e) => setFormData({ ...formData, roamStatus: e.target.value as Schema['Risk']['type']['roamStatus'] })}
                                    >
                                        <MenuItem value="RESOLVED">Resolved</MenuItem>
                                        <MenuItem value="OWNED">Owned</MenuItem>
                                        <MenuItem value="ACCEPTED">Accepted</MenuItem>
                                        <MenuItem value="MITIGATED">Mitigated</MenuItem>
                                    </Select>
                                </FormControl>
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
                    {risks.length === 0 && !isCreating ? (
                        <Typography color="text.secondary" fontStyle="italic" align="center" py={4}>No risks identified.</Typography>
                    ) : (
                        risks.map(risk => {
                            const isEditing = editingId === risk.id;
                            if (isEditing) {
                                return (
                                    <Box key={risk.id} p={2} bgcolor="grey.50" borderRadius={1} border={1} borderColor="primary.main">
                                        <Stack spacing={2}>
                                            <TextField
                                                label="Description"
                                                fullWidth
                                                size="small"
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            />
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                                    <InputLabel>Impact</InputLabel>
                                                    <Select
                                                        value={formData.impact}
                                                        label="Impact"
                                                        onChange={(e) => setFormData({ ...formData, impact: e.target.value as Schema['Risk']['type']['impact'] })}
                                                    >
                                                        <MenuItem value="LOW">Low</MenuItem>
                                                        <MenuItem value="MEDIUM">Medium</MenuItem>
                                                        <MenuItem value="HIGH">High</MenuItem>
                                                        <MenuItem value="CRITICAL">Critical</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <TextField
                                                    label="Prob (%)"
                                                    type="number"
                                                    size="small"
                                                    sx={{ width: 100 }}
                                                    value={formData.probability}
                                                    onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                                                />
                                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                                    <InputLabel>ROAM</InputLabel>
                                                    <Select
                                                        value={formData.roamStatus}
                                                        label="ROAM"
                                                        onChange={(e) => setFormData({ ...formData, roamStatus: e.target.value as Schema['Risk']['type']['roamStatus'] })}
                                                    >
                                                        <MenuItem value="RESOLVED">Resolved</MenuItem>
                                                        <MenuItem value="OWNED">Owned</MenuItem>
                                                        <MenuItem value="ACCEPTED">Accepted</MenuItem>
                                                        <MenuItem value="MITIGATED">Mitigated</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Stack>
                                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                                <IconButton size="small" onClick={() => setEditingId(null)}><CloseIcon /></IconButton>
                                                <IconButton color="primary" size="small" onClick={() => handleUpdate(risk.id)}><SaveIcon /></IconButton>
                                            </Stack>
                                        </Stack>
                                    </Box>
                                );
                            }
                            return (
                                <Box key={risk.id} p={1.5} border={1} borderColor="divider" borderRadius={1} display="flex" justifyContent="space-between" alignItems="flex-start">
                                    <Box>
                                        <Typography variant="body2" fontWeight="500">{risk.description}</Typography>
                                        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                                            <Chip label={`Impact: ${risk.impact}`} size="small" color={['HIGH', 'CRITICAL'].includes(risk.impact || '') ? 'error' : 'default'} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                            <Chip label={`Prob: ${risk.probability}%`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                            <Chip label={`ROAM: ${risk.roamStatus}`} size="small" color={risk.roamStatus === 'RESOLVED' ? 'success' : risk.roamStatus === 'MITIGATED' ? 'info' : 'warning'} sx={{ height: 20, fontSize: '0.65rem' }} />
                                        </Stack>
                                    </Box>
                                    <Stack direction="row">
                                        <IconButton size="small" onClick={() => startEdit(risk)}><EditIcon fontSize="small" /></IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDelete(risk.id)}><DeleteIcon fontSize="small" /></IconButton>
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
