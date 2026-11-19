-- GUSTO · 006 · Grafo de funcionalidades reservado ao administrador · by m3d.pro
-- can_use(): o root sempre passa; com a funcionalidade desligada globalmente, nenhum outro usuário acessa
-- (nem com liberação individual). Para abrir a outros usuários no futuro: UPDATE features SET enabled=true ...
UPDATE features SET enabled = false, label = 'Grafo de funcionalidades (administrador)' WHERE code = 'os_graph';
