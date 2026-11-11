let currentUser = null;

function initApp() {
    loadPhotos();
    setupEventListeners();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function setupEventListeners() {
    document.getElementById('btnOpenLogin').addEventListener('click', openLoginModal);
    document.getElementById('closeLoginModal').addEventListener('click', closeLoginModal);
    document.getElementById('btnCancelLogin').addEventListener('click', closeLoginModal);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    document.getElementById('btnVerPerfil').addEventListener('click', () => {
        if (!currentUser) { openLoginModal(); return; }
        if (currentUser.tipo === 'fotografo') {
            loadUserStats();
            document.getElementById('sidebarMenu').classList.remove('hidden');
        }
    });
    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('sidebarMenu').classList.add('hidden');
    });
    document.getElementById('btnLogout').addEventListener('click', handleLogout);

    document.getElementById('searchInput').addEventListener('input', (e) => {
        loadPhotos(e.target.value.trim());
    });
    document.getElementById('searchInput').addEventListener('click', () => {
        if (!currentUser) openLoginModal();
    });

    document.getElementById('btnMinhasPublicacoes').addEventListener('click', () => {
        document.getElementById('uploadModal').classList.remove('hidden');
        loadUserPosts();
    });
    document.getElementById('closeUploadModal').addEventListener('click', () => {
        document.getElementById('uploadModal').classList.add('hidden');
    });
    document.getElementById('imgFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        document.getElementById('fileNameDisplay').textContent = file ? file.name : 'Nenhum arquivo escolhido';
    });
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
}

async function loadPhotos(searchTerm = '') {
    let query = supabase
        .from('publicacoes')
        .select(`
            *,
            usuarios!inner (nome),
            curtidas (id, usuario_id)
        `);

    if (searchTerm) {
        const cleanTerm = searchTerm.replace('@', '');
        query = query.ilike('usuarios.nome', `%${cleanTerm}%`);
    }

    const { data: photos, error } = await query;
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    if (error || !photos || photos.length === 0) {
        if (searchTerm !== '') {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; font-weight: bold;">Fotógrafo não encontrado</p>';
        }
        return;
    }

    photos.forEach(photo => {
        const totalCurtidas = photo.curtidas ? photo.curtidas.length : 0;
        const jaCurtido = currentUser && photo.curtidas && photo.curtidas.some(c => c.usuario_id === currentUser.id);
        const heartColor = jaCurtido ? '#FF0000' : '#000000';

        const card = document.createElement('div');
        card.className = 'photo-card';
        card.innerHTML = `
            <img src="${photo.imagem_url}" class="main-photo" alt="${photo.titulo}">
            <div class="photo-tooltip">
                <p>Foto tirada por: @${photo.usuarios?.nome}</p>
                <p>Local: ${photo.localizacao}</p>
            </div>
            <div class="photo-info">
                <span>${photo.titulo}</span>
                <button class="like-btn" onclick="toggleLike(${photo.id})">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="${heartColor}">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span>${totalCurtidas}</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value.trim();

    let valid = true;
    document.getElementById('emailError').classList.add('hidden');
    document.getElementById('senhaError').classList.add('hidden');
    document.getElementById('loginGeneralError').classList.add('hidden');

    if (!email || !email.includes('@')) {
        document.getElementById('emailError').classList.remove('hidden');
        valid = false;
    }
    if (!senha) {
        document.getElementById('senhaError').classList.remove('hidden');
        valid = false;
    }

    if (!valid) return;

    const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('senha', senha)
        .maybeSingle();

    if (error) {
        const genErr = document.getElementById('loginGeneralError');
        genErr.textContent = 'Erro ao tentar fazer login';
        genErr.classList.remove('hidden');
        return;
    }

    if (user) {
        currentUser = user;
        updateUI();
        closeLoginModal();
        loadPhotos();
    } else {
        const genErr = document.getElementById('loginGeneralError');
        genErr.textContent = 'Usuário não encontrado ou senha incorreta';
        genErr.classList.remove('hidden');
    }
}

async function toggleLike(photoId) {
    if (!currentUser) {
        openLoginModal();
        return;
    }

    const { data: existingLike } = await supabase
        .from('curtidas')
        .select('id')
        .eq('usuario_id', currentUser.id)
        .eq('publicacao_id', photoId)
        .maybeSingle();

    if (existingLike) {
        await supabase.from('curtidas').delete().eq('id', existingLike.id);
    } else {
        await supabase.from('curtidas').insert([{ usuario_id: currentUser.id, publicacao_id: photoId }]);
    }

    loadPhotos(document.getElementById('searchInput').value.trim());
}

async function handleUpload(e) {
    e.preventDefault();
    if (!currentUser || currentUser.tipo !== 'fotografo') return;

    const titulo = document.getElementById('imgTitulo').value.trim();
    const local = document.getElementById('imgLocal').value.trim();
    const file = document.getElementById('imgFile').files[0];

    if (!titulo || !local || !file) {
        alert('Preencha todos os campos obrigatórios.');
        return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error: storageError } = await supabase.storage.from('fotos').upload(fileName, file);

    if (storageError) {
        alert('Erro ao realizar o upload da imagem.');
        return;
    }

    const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(fileName);

    const { error: dbError } = await supabase.from('publicacoes').insert([{
        usuario_id: currentUser.id,
        titulo: titulo,
        localizacao: local,
        imagem_url: urlData.publicUrl
    }]);

    if (!dbError) {
        document.getElementById('uploadForm').reset();
        document.getElementById('fileNameDisplay').textContent = 'Nenhum arquivo escolhido';
        document.getElementById('uploadModal').classList.add('hidden');
        loadPhotos();
        loadUserPosts();
    } else {
        alert('Erro ao cadastrar publicação.');
    }
}

async function loadUserStats() {
    const { data: posts } = await supabase.from('publicacoes').select('id').eq('usuario_id', currentUser.id);
    const postCount = posts ? posts.length : 0;

    let totalLikes = 0;
    if (postCount > 0) {
        const postIds = posts.map(p => p.id);
        const { data: likes } = await supabase.from('curtidas').select('id').in('publicacao_id', postIds);
        totalLikes = likes ? likes.length : 0;
    }

    document.getElementById('statsLikes').textContent = `${totalLikes} Likes`;
    document.getElementById('statsPosts').textContent = `${postCount} Publicações`;
}

async function loadUserPosts() {
    const { data: posts } = await supabase.from('publicacoes').select('*').eq('usuario_id', currentUser.id);
    const list = document.getElementById('userPostsList');
    list.innerHTML = '';

    posts?.forEach(post => {
        const div = document.createElement('div');
        div.className = 'post-manage-item';
        div.innerHTML = `
            <span>${post.titulo}</span>
            <img src="assets/lixeira.svg" class="delete-icon" onclick="deletePost(${post.id})" alt="Excluir" style="width:18px;height:18px;">
        `;
        list.appendChild(div);
    });
}

async function deletePost(postId) {
    await supabase.from('publicacoes').delete().eq('id', postId);
    loadUserPosts();
    loadPhotos();
}

function openLoginModal() { document.getElementById('loginModal').classList.remove('hidden'); }
function closeLoginModal() { 
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('loginForm').reset();
}

function updateUI() {
    if (currentUser) {
        document.getElementById('headerUsername').textContent = `@${currentUser.nome}`;
        const fp = currentUser.foto_perfil;
        const avatar = (fp && fp !== 'default.png') ? (fp.startsWith('http') || fp.startsWith('assets/') ? fp : 'assets/' + fp) : 'assets/default-user.png';
        document.getElementById('headerAvatar').src = avatar;
        document.getElementById('btnVerPerfil').disabled = currentUser.tipo !== 'fotografo';
        document.getElementById('authAction').innerHTML = `<button class="btn-black" onclick="handleLogout()">Logout</button>`;
    }
}

function handleLogout() {
    currentUser = null;
    location.reload();
}
