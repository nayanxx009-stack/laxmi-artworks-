import React, { useState } from 'react';
import { Download, Upload, Database, CheckCircle2 } from 'lucide-react';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { adminDb as db } from '../lib/firebase';

export default function AdminBackup() {
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const collectionsToBackup = ['orders', 'users', 'reviews', 'subscribers', 'gallery'];

  const handleBackup = async () => {
    setIsProcessing(true);
    setStatus('Gathering data...');
    try {
      const backupData: any = {};
      for (const colName of collectionsToBackup) {
        setStatus(`Fetching ${colName}...`);
        const snapshot = await getDocs(collection(db, colName));
        backupData[colName] = [];
        snapshot.forEach(docSnap => {
          backupData[colName].push({ id: docSnap.id, ...docSnap.data() });
        });
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laxmi_artworks_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setStatus('Backup downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    }
    setIsProcessing(false);
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('WARNING: Restoring will overwrite existing documents with the same IDs. Are you sure?')) {
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    setStatus('Reading file...');
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      for (const colName of collectionsToBackup) {
        if (data[colName] && Array.isArray(data[colName])) {
          setStatus(`Restoring ${colName} (${data[colName].length} items)...`);
          for (const item of data[colName]) {
            const { id, ...docData } = item;
            if (id) {
              await setDoc(doc(db, colName, id), docData, { merge: true });
            }
          }
        }
      }
      setStatus('Restore completed successfully!');
    } catch (err: any) {
      console.error(err);
      setStatus(`Restore failed: ${err.message}`);
    }
    e.target.value = '';
    setIsProcessing(false);
  };

  return (
    <div className="p-6 text-white space-y-8 max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <Database className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-3xl font-display font-medium mb-2">System Backup</h2>
        <p className="text-neutral-400">Download a full snapshot of your database or restore from a previous backup.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <button
          onClick={handleBackup}
          disabled={isProcessing}
          className="bg-neutral-900 border border-white/10 hover:border-amber-500/50 p-8 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all hover:bg-neutral-800 group disabled:opacity-50"
        >
          <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-black transition-colors">
            <Download size={24} />
          </div>
          <div className="text-center">
            <h3 className="font-bold uppercase tracking-widest text-sm mb-1">Download Backup</h3>
            <p className="text-xs text-neutral-500">Save data as JSON</p>
          </div>
        </button>

        <label className={`bg-neutral-900 border border-white/10 hover:border-blue-500/50 p-8 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all hover:bg-neutral-800 group ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-black transition-colors">
            <Upload size={24} />
          </div>
          <div className="text-center">
            <h3 className="font-bold uppercase tracking-widest text-sm mb-1">Restore Backup</h3>
            <p className="text-xs text-neutral-500">Upload JSON file</p>
          </div>
          <input type="file" accept=".json" onChange={handleRestore} disabled={isProcessing} className="hidden" />
        </label>
      </div>

      {status && (
        <div className="mt-8 bg-neutral-900 p-4 rounded-xl border border-white/10 text-center flex items-center justify-center gap-3">
          {status.includes('success') ? <CheckCircle2 className="text-green-500" size={20} /> : <div className="w-5 h-5 border-2 border-neutral-700 border-t-amber-500 rounded-full animate-spin"></div>}
          <span className="text-sm text-neutral-300 font-medium">{status}</span>
        </div>
      )}
    </div>
  );
}
