import { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent,
    Typography, IconButton,
    Chip, Table, TableBody, TableCell,
    TableHead, TableRow, TableContainer, Paper
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import HeartbeatWizard from './HeartbeatWizard';

const client = generateClient<Schema>();

interface Props {
    open: boolean;
    onClose: () => void;
    item: { id: string, [key: string]: unknown };
    itemType: 'initiative' | 'outcome' | 'objective' | 'kr';
}

export default function HeartbeatHistoryDialog({ open, onClose, item, itemType }: Props) {
    const [heartbeats, setHeartbeats] = useState<Schema['Heartbeat']['type'][]>([]);
    const [loading, setLoading] = useState(true);
    const [editWizardState, setEditWizardState] = useState<{ open: boolean, heartbeat: Schema['Heartbeat']['type'] | null }>({
        open: false,
        heartbeat: null
    });

    // Use callback to stabilize function reference
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            // Filter heartbeats by the appropriate ID field
            let filter: Record<string, unknown> = {};
            // Strict ID check
            if (!item?.id) return;

            if (itemType === 'initiative') filter = { initiativeId: { eq: item.id } };
            else if (itemType === 'outcome') filter = { outcomeId: { eq: item.id } };
            else if (itemType === 'objective') filter = { strategicObjectiveId: { eq: item.id } };
            else if (itemType === 'kr') filter = { keyResultId: { eq: item.id } };

            // Explicitly ensure we are filtering for non-null ID
            console.log("Fetching history for", itemType, item.id);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data } = await (client.models.Heartbeat as any).list({
                filter: filter,
                limit: 100 // Last 100
                // sortDirection: 'DESC' // Not supported in list unless indexed, usually client sort is safer
            });

            // Client side sort
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sorted = data.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setHeartbeats(sorted);
        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setLoading(false);
        }
    }, [item?.id, itemType]);

    useEffect(() => {
        if (open) fetchHistory();
    }, [open, fetchHistory]);

    const handleEdit = (hb: Schema['Heartbeat']['type']) => {
        setEditWizardState({ open: true, heartbeat: hb });
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
                <DialogTitle display="flex" justifyContent="space-between" alignItems="center">
                    Heartbeat History
                    <IconButton onClick={onClose}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {loading ? (
                        <Typography>Loading...</Typography>
                    ) : heartbeats.length === 0 ? (
                        <Typography color="text.secondary" align="center" py={4}>No heartbeats recorded yet.</Typography>
                    ) : (
                        <TableContainer component={Paper} elevation={0} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Confidence</TableCell>
                                        <TableCell>Summary</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {heartbeats.map((hb) => (
                                        <TableRow key={hb.id}>
                                            <TableCell>{new Date(hb.timestamp).toLocaleDateString()} {new Date(hb.timestamp).toLocaleTimeString()}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={`${hb.ownerInput?.ownerConfidence ?? hb.systemAssessment?.systemConfidence ?? 0}%`}
                                                    size="small"
                                                    color={
                                                        (hb.ownerInput?.ownerConfidence ?? 0) >= 80 ? 'success' :
                                                            (hb.ownerInput?.ownerConfidence ?? 0) >= 50 ? 'warning' : 'error'
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {hb.ownerInput?.progressSummary || '-'}
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton size="small" onClick={() => handleEdit(hb)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
            </Dialog>

            {editWizardState.open && editWizardState.heartbeat && (
                <HeartbeatWizard
                    open={editWizardState.open}
                    onClose={() => {
                        setEditWizardState({ open: false, heartbeat: null });
                        fetchHistory(); // Refresh after edit
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    item={item as any} // Pass the parent item for context
                    itemType={itemType}
                    onComplete={fetchHistory}
                    editHeartbeatId={editWizardState.heartbeat.id}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    initialData={editWizardState.heartbeat as any}
                />
            )}
        </>
    );
}
