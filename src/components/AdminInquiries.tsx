import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trash2, Mail, ExternalLink, CheckCircle } from 'lucide-react';

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setInquiries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this inquiry?")) {
      await deleteDoc(doc(db, 'inquiries', id));
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateDoc(doc(db, 'inquiries', id), { status });
  };

  if (loading) return <div className="p-8 text-neutral-500">Loading inquiries...</div>;

  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
            <th className="p-5 pl-6">Customer</th>
            <th className="p-5">Message</th>
            <th className="p-5">Date</th>
            <th className="p-5">Status</th>
            <th className="p-5 pr-6 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-sm">
          {inquiries.length === 0 && (
            <tr><td colSpan={5} className="p-6 text-center text-neutral-500">No inquiries found.</td></tr>
          )}
          {inquiries.map((inq) => (
            <tr key={inq.id} className="hover:bg-white/[0.02] transition-colors group">
              <td className="p-5 pl-6 align-top">
                <div className="font-bold text-white mb-1">{inq.name}</div>
                <a href={`mailto:${inq.email}`} className="text-amber-500 hover:underline text-xs flex items-center gap-1 mb-1"><Mail size={12}/> {inq.email}</a>
                {inq.phone && <div className="text-neutral-500 text-xs">{inq.phone}</div>}
              </td>
              <td className="p-5 align-top max-w-xs">
                <p className="text-neutral-300 text-sm whitespace-pre-wrap">{inq.message || 'No message provided'}</p>
              </td>
              <td className="p-5 align-top whitespace-nowrap text-neutral-400">
                {inq.createdAt ? new Date(inq.createdAt).toLocaleString() : 'N/A'}
              </td>
              <td className="p-5 align-top">
                <select
                  value={inq.status || 'New'}
                  onChange={(e) => handleStatusChange(inq.id, e.target.value)}
                  className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:border-amber-500 outline-none"
                >
                  <option value="New">New</option>
                  <option value="Read">Read</option>
                  <option value="Replied">Replied</option>
                  <option value="Closed">Closed</option>
                </select>
              </td>
              <td className="p-5 pr-6 align-top text-right space-x-2">
                <a 
                  href={`mailto:${inq.email}?subject=Reply to your Inquiry&body=Hi ${inq.name},`}
                  className="inline-flex p-2 bg-neutral-900 text-amber-500 rounded-lg hover:bg-neutral-800 transition"
                  title="Reply via Email"
                >
                  <Mail size={16} />
                </a>
                <button 
                  onClick={() => handleDelete(inq.id)}
                  className="inline-flex p-2 bg-neutral-900 text-red-400 rounded-lg hover:bg-neutral-800 transition"
                  title="Delete Inquiry"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
