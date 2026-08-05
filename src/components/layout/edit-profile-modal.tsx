import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfileStore } from "@/stores/profile-store";
import { useAuthStore } from "@/stores/auth-store";
import { updateProfileFullName } from "@/lib/profile";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditProfileModal({ open, onOpenChange }: Props) {
  const name = useProfileStore((s) => s.name);
  const setName = useProfileStore((s) => s.setName);
  const userId = useAuthStore((s) => s.session?.user.id);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(name);
  }, [open, name]);

  const handleSave = async () => {
    setName(draft);
    if (userId) {
      setSaving(true);
      const { data, error } = await updateProfileFullName(userId, draft);
      setSaving(false);
      if (error) {
        toast.error("Não foi possível salvar agora", { description: error.message });
        return;
      }
      if (data) setProfile(data);
    }
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar perfil"
      description="Seu nome aparece na saudação da dashboard e no seu avatar."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="profile-name">Nome</Label>
        <Input
          id="profile-name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Como quer ser chamado?"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
        />
      </div>
    </Modal>
  );
}
