import { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, Slider, TextField, Stack,
    IconButton, Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BalanceIcon from '@mui/icons-material/Balance';

interface Item {
    id: string;
    title: string; // or statement
    weight: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    items: Item[];
    parentTitle: string;
    childType: 'Outcome' | 'Key Result' | 'Initiative';
    onSave: (updates: { id: string, weight: number }[]) => Promise<void>;
}

export default function WeightDistributionModal({ open, onClose, items, parentTitle, childType, onSave }: Props) {
    const [localWeights, setLocalWeights] = useState<{ [id: string]: number }>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open) {
            const initial: { [id: string]: number } = {};
            items.forEach(i => {
                initial[i.id] = i.weight || 0;
            });
            setLocalWeights(initial);
        }
    }, [open, items]);

    const totalWeight = useMemo(() => {
        return Object.values(localWeights).reduce((sum, w) => sum + (w || 0), 0);
    }, [localWeights]);

    const handleChange = (id: string, newVal: number) => {
        setLocalWeights(prev => ({ ...prev, [id]: newVal }));
    };

    const handleDistributeEvenly = () => {
        const count = items.length;
        if (count === 0) return;
        const val = Math.floor(100 / count);
        const remainder = 100 - (val * count);

        const newWeights: { [id: string]: number } = {};
        items.forEach((item, index) => {
            newWeights[item.id] = val + (index < remainder ? 1 : 0); // Distribute remainder
        });
        setLocalWeights(newWeights);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = Object.entries(localWeights).map(([id, weight]) => ({ id, weight }));
            await onSave(updates);
            onClose();
        } catch (e) {
            console.error("Failed to save weights", e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                    <Typography variant="h6">Adjust Weights</Typography>
                    <Typography variant="caption" color="text.secondary">
                        For {childType}s under "{parentTitle}"
                    </Typography>
                </Box>
                <IconButton onClick={onClose}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography
                        variant="subtitle1"
                        fontWeight="bold"
                        color={totalWeight > 100 ? 'error.main' : 'success.main'}
                    >
                        Total: {totalWeight}% / 100%
                    </Typography>
                    <Button
                        startIcon={<BalanceIcon />}
                        size="small"
                        onClick={handleDistributeEvenly}
                    >
                        Distribute Evenly
                    </Button>
                </Box>

                {totalWeight > 100 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        Total weight cannot exceed 100%. Please reduce {totalWeight - 100}%.
                    </Alert>
                )}

                <Stack spacing={3}>
                    {items.map(item => (
                        <Box key={item.id}>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                                <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: '70%' }}>
                                    {item.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {localWeights[item.id] ?? 0}%
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Slider
                                    value={localWeights[item.id] ?? 0}
                                    onChange={(_, val) => handleChange(item.id, val as number)}
                                    min={0}
                                    max={100}
                                    step={1}
                                    sx={{ flexGrow: 1 }}
                                />
                                <TextField
                                    type="number"
                                    size="small"
                                    value={localWeights[item.id] ?? 0}
                                    onChange={(e) => handleChange(item.id, parseInt(e.target.value) || 0)}
                                    inputProps={{ min: 0, max: 100 }}
                                    sx={{ width: 80 }}
                                />
                            </Stack>
                        </Box>
                    ))}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={isSaving || totalWeight > 100}
                >
                    {isSaving ? 'Saving...' : 'Save Weights'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
