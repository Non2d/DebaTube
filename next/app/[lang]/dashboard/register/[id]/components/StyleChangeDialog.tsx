import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../../../../context/LanguageContext';

interface StyleChangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export function StyleChangeDialog({ open, onOpenChange, onConfirm }: StyleChangeDialogProps) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <div className="mx-auto bg-yellow-100 dark:bg-yellow-900/30 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-yellow-600 dark:text-yellow-400">
                        <AlertTriangle size={24} />
                    </div>
                    <DialogTitle className="text-center">{t('dashboard.modal.styleChange.title')}</DialogTitle>
                    <DialogDescription className="text-center pt-2">
                        {t('dashboard.modal.styleChange.warning')}
                        <br />
                        {t('dashboard.modal.styleChange.recommendation')}
                        <br />
                        <br />
                        {t('dashboard.modal.styleChange.confirm')}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-3 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('dashboard.modal.styleChange.cancel')}
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => {
                            onConfirm();
                            onOpenChange(false);
                        }}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                        {t('dashboard.modal.styleChange.change')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
