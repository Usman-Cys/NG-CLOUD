import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { adminApi } from "../../api/adminApi";
import GlassCard from "../../components/common/GlassCard";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import { Search, RefreshCw, X, ShieldAlert, AlertOctagon, Trash2 } from "lucide-react";

const InfoRow = ({ k, v }) => (
  <div className="flex justify-between py-2 border-b border-white/5 last:border-b-0 text-sm">
    <span className="text-slate-400 font-medium">{k}</span>
    <span className="text-slate-200">{v}</span>
  </div>
);

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingQuota, setEditingQuota] = useState(false);
  const [newQuotaMb, setNewQuotaMb] = useState("");

  // Deletion modals state
  const [deleteTargetUser, setDeleteTargetUser] = useState(null); // { id, username }
  const [showDeletionOptions, setShowDeletionOptions] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [checkedPermanent, setCheckedPermanent] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadUsers(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadUsers();

    const interval = setInterval(() => {
      loadUsers(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function handleSoftDeleteUser() {
    if (!deleteTargetUser) return;
    setDeleteLoading(true);
    try {
      const res = await adminApi.deleteUser(deleteTargetUser.id, false);
      toast.success(res.message || "User soft-deleted successfully.");
      setDeleteTargetUser(null);
      setShowDeletionOptions(false);
      loadUsers(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to soft-delete user.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handlePermanentDeleteUser() {
    if (!deleteTargetUser) return;
    if (!checkedPermanent) {
      return toast.error("Please check the confirmation box.");
    }
    if (confirmInput.toUpperCase() !== "DELETE") {
      return toast.error("Please type DELETE to confirm permanent deletion.");
    }

    const firstConfirm = window.confirm(`WARNING: You are about to permanently delete "${deleteTargetUser.username}" and purge all their chunks from MinIO storage. This action is irreversible. Are you sure you want to proceed?`);
    if (!firstConfirm) return;

    setDeleteLoading(true);
    try {
      const res = await adminApi.deleteUser(deleteTargetUser.id, true);
      toast.success(res.message || "User permanently deleted from storage.");
      setDeleteTargetUser(null);
      setShowDeletionOptions(false);
      setConfirmInput("");
      setCheckedPermanent(false);
      loadUsers(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to permanently delete user.");
    } finally {
      setDeleteLoading(false);
    }
  }

  const rows = useMemo(() => {
    return (users || []).filter(u =>
      u.username.toLowerCase().includes(q.toLowerCase())
    );
  }, [users, q]);

  if (loading) return <Loader />;

  return (
    <div className="space-y-4 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display text-white">Users Directory</h1>
          <p className="text-slate-400 text-sm mt-1">
            User operational metadata only. Password hashes and private keys are never exposed.
          </p>
        </div>
        <button
          onClick={() => loadUsers(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          className="input pl-10 bg-slate-900/40 border-white/5 text-slate-200 text-sm py-2 rounded-xl w-full focus:outline-none focus:border-cyan-500/30"
          placeholder="Search users by name…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="glass overflow-hidden rounded-2xl border border-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Files count</th>
                <th className="px-4 py-3">Storage Consumption</th>
                <th className="px-4 py-3">Kyber Key</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-violet-500/5 transition-colors">
                  <td className="px-4 py-3 font-semibold text-white">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setNewQuotaMb(u.storageQuotaMb);
                        setEditingQuota(false);
                      }}
                      className="hover:underline hover:text-cyan-300 text-left"
                    >
                      {u.username}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize">{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status === "active" ? "ok" : "disabled"} label={u.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">{u.filesCount}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {u.storageUsedMb} / {u.storageQuotaMb} MB
                    <span className="text-slate-500 block text-[10px]">
                      Rem: {Math.max(0, u.storageQuotaMb - u.storageUsedMb).toFixed(1)} MB
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {u.hasKyberPublicKey ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.status === "deleted" ? (
                      <span className="text-xs text-slate-500 font-medium italic">Deleted</span>
                    ) : (
                      <button
                        onClick={() => {
                          setDeleteTargetUser({ id: u.id, username: u.username });
                          setShowDeletionOptions(false);
                          setConfirmInput("");
                          setCheckedPermanent(false);
                        }}
                        className="px-3 py-1 text-xs rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-all duration-200"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No users registered in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 mt-2">Password hashes and private keys are never exposed to the admin interface.</p>

      {/* User Metadata Inspector Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative max-w-md w-full">
            <GlassCard className="border-cyan-500/30 p-6 relative" hover={false}>
              <button
                onClick={() => setSelectedUser(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="h-5 w-5 text-cyan-400" />
                <h3 className="font-display text-lg text-white">User Metadata Inspector</h3>
              </div>

              <div className="space-y-1">
                <InfoRow k="User ID" v={<span className="font-mono text-xs text-slate-400">{selectedUser.id}</span>} />
                <InfoRow k="Username" v={selectedUser.username} />
                <InfoRow k="Role" v={<span className="capitalize">{selectedUser.role}</span>} />
                <InfoRow k="Status" v={<StatusBadge status={selectedUser.status === "active" ? "ok" : "disabled"} label={selectedUser.status} />} />
                <InfoRow k="Total Uploads" v={selectedUser.filesCount} />
                <InfoRow k="Storage Used" v={`${selectedUser.storageUsedMb} MB`} />
                <InfoRow k="Remaining Space" v={`${Math.max(0, selectedUser.storageQuotaMb - selectedUser.storageUsedMb).toFixed(1)} MB`} />
                <InfoRow
                  k="Storage Quota"
                  v={
                    editingQuota ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="input py-0.5 px-2 text-xs w-20 border-white/10 bg-slate-950 text-white rounded-lg focus:outline-none focus:border-cyan-500/30"
                          value={newQuotaMb}
                          onChange={e => setNewQuotaMb(e.target.value)}
                        />
                        <button
                          onClick={async () => {
                            try {
                              const quotaVal = Number(newQuotaMb);
                              if (isNaN(quotaVal) || quotaVal < 10 || quotaVal > 102400) {
                                return toast.error("Quota must be between 10 MB and 102400 MB");
                              }
                              await adminApi.updateUserQuota(selectedUser.id, quotaVal);
                              toast.success("User quota updated successfully");
                              setEditingQuota(false);
                              setSelectedUser(prev => ({
                                ...prev,
                                storageQuotaMb: quotaVal
                              }));
                              loadUsers(true);
                            } catch (err) {
                              toast.error(err.response?.data?.message || "Failed to update quota");
                            }
                          }}
                          className="text-xs text-emerald-400 hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingQuota(false);
                            setNewQuotaMb(selectedUser.storageQuotaMb);
                          }}
                          className="text-xs text-slate-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{selectedUser.storageQuotaMb} MB</span>
                        <button
                          onClick={() => {
                            setNewQuotaMb(selectedUser.storageQuotaMb);
                            setEditingQuota(true);
                          }}
                          className="text-[11px] text-cyan-400 hover:underline hover:text-cyan-300"
                        >
                          Edit
                        </button>
                      </div>
                    )
                  }
                />
                <InfoRow k="Last Login" v={selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "Never"} />
                <InfoRow k="Kyber Key Exists" v={selectedUser.hasKyberPublicKey ? "Yes" : "No"} />
                <InfoRow k="Registration Date" v={new Date(selectedUser.createdAt).toLocaleDateString()} />
              </div>

              <Button
                variant="outline"
                onClick={() => setSelectedUser(null)}
                className="w-full mt-6"
              >
                Close Inspector
              </Button>
            </GlassCard>
          </div>
        </div>
      )}
      {/* Step 1: Initial Warning Modal */}
      {deleteTargetUser && !showDeletionOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative max-w-md w-full">
            <GlassCard className="border-rose-500/30 p-6 relative" hover={false}>
              <button
                onClick={() => setDeleteTargetUser(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="h-6 w-6 text-rose-400 animate-pulse" />
                <h3 className="font-display text-lg text-white">Delete User Account</h3>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                Are you sure you want to delete the user <strong className="text-white">"{deleteTargetUser.username}"</strong>? This action will restrict their account access and affect their file metadata.
              </p>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setDeleteTargetUser(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setShowDeletionOptions(true)}
                  variant="danger"
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Step 2: Double Confirmation Deletion Options Modal */}
      {deleteTargetUser && showDeletionOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative max-w-lg w-full">
            <GlassCard className="border-rose-500/30 p-6 relative" hover={false}>
              <button
                onClick={() => {
                  setDeleteTargetUser(null);
                  setShowDeletionOptions(false);
                  setConfirmInput("");
                  setCheckedPermanent(false);
                }}
                disabled={deleteLoading}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <AlertOctagon className="h-6 w-6 text-rose-400" />
                <h3 className="font-display text-lg text-white">Administrative Action: Delete User</h3>
              </div>

              <p className="text-sm text-slate-300 mb-4">
                Choose the deletion method for user: <strong className="text-white font-mono">{deleteTargetUser.username}</strong>.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {/* Soft Delete Card */}
                <div className="border border-white/5 bg-slate-900/40 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Option 1: Soft Delete</h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Disables the user account and flags all their files as deleted in PostgreSQL. The physical chunk blocks in MinIO are retained for safety.
                    </p>
                  </div>
                  <Button
                    onClick={handleSoftDeleteUser}
                    loading={deleteLoading}
                    variant="outline"
                    className="w-full mt-4 text-xs py-2"
                  >
                    Apply Soft Delete
                  </Button>
                </div>

                {/* Hard Delete Card */}
                <div className="border border-rose-500/10 bg-rose-950/10 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs uppercase font-semibold text-rose-300 tracking-wider">Option 2: Hard Delete</h4>
                    <p className="text-[11px] text-rose-400/80 mt-1">
                      Permanently wipes the user from the database and cascades to erase all files, locks, keys, and physically purges all object blocks from MinIO.
                    </p>
                  </div>

                  <div className="mt-3 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="check-perm-user"
                      className="mt-0.5 rounded border-white/10 bg-slate-950 text-rose-500 focus:ring-0 cursor-pointer"
                      checked={checkedPermanent}
                      onChange={e => setCheckedPermanent(e.target.checked)}
                      disabled={deleteLoading}
                    />
                    <label htmlFor="check-perm-user" className="text-[10px] text-rose-300 leading-tight cursor-pointer select-none">
                      I understand this will permanently purge all chunks from MinIO.
                    </label>
                  </div>

                  <div className="mt-3">
                    <label className="text-[10px] text-rose-400/70 font-medium">Type <strong className="text-white">DELETE</strong> to confirm:</label>
                    <input
                      type="text"
                      className="input py-1 text-xs px-2 mt-1 border-rose-500/20 text-rose-100"
                      placeholder="DELETE"
                      disabled={deleteLoading || !checkedPermanent}
                      value={confirmInput}
                      onChange={e => setConfirmInput(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handlePermanentDeleteUser}
                    loading={deleteLoading}
                    disabled={!checkedPermanent || confirmInput.toUpperCase() !== "DELETE"}
                    variant="danger"
                    icon={Trash2}
                    className="w-full mt-3 text-xs py-2"
                  >
                    Delete Permanently
                  </Button>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
