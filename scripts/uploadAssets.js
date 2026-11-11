const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://hqjexwjwopspvambldew.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IadiN4ZnMASIYiPTc_9LJw_XWprtL_4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET_NAME = 'fotos';

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jpg': case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        default: return 'application/octet-stream';
    }
}

async function uploadFileToSupabase(filePath, destFileName) {
    const fileBuffer = fs.readFileSync(filePath);
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(destFileName, fileBuffer, {
            contentType: getContentType(filePath),
            upsert: true
        });
    if (error) {
        console.error('Erro ao enviar ' + destFileName + ':', error.message);
        return null;
    }
    const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(destFileName);
    console.log('Upload concluido: ' + destFileName);
    return publicUrlData.publicUrl;
}

async function run() {
    console.log('Iniciando envio de imagens para o Supabase Storage...');
    const assetsDir = path.join(__dirname, '../assets');
    const assetFiles = fs.readdirSync(assetsDir);

    for (const file of assetFiles) {
        const fullPath = path.join(assetsDir, file);
        if (fs.lstatSync(fullPath).isFile() && (file.startsWith('fotografo') || file.startsWith('usuario') || file === 'default-user.png')) {
            const dest = 'perfis/' + file;
            const publicUrl = await uploadFileToSupabase(fullPath, dest);
            if (publicUrl && file.startsWith('fotografo')) {
                const num = file.replace('fotografo', '').replace('.jpg', '');
                await supabase.from('usuarios')
                    .update({ foto_perfil: publicUrl })
                    .ilike('nome', '%fotografo' + num + '%');
            }
            if (publicUrl && file.startsWith('usuario')) {
                const num = file.replace('usuario', '').replace('.jpg', '');
                await supabase.from('usuarios')
                    .update({ foto_perfil: publicUrl })
                    .ilike('nome', '%usuario' + num + '%');
            }
        }
    }

    const fotosDir = path.join(assetsDir, 'fotografias');
    if (fs.existsSync(fotosDir)) {
        const galeriaFiles = fs.readdirSync(fotosDir);
        for (const file of galeriaFiles) {
            const fullPath = path.join(fotosDir, file);
            if (fs.lstatSync(fullPath).isFile()) {
                const publicUrl = await uploadFileToSupabase(fullPath, 'galeria/' + file);
                if (publicUrl) {
                    const { data: fotografos } = await supabase
                        .from('usuarios')
                        .select('id')
                        .eq('tipo', 'fotografo')
                        .limit(1);
                    const fotografoId = fotografos && fotografos.length > 0 ? fotografos[0].id : 1;
                    const numFoto = file.replace('foto', '').replace(/\.[^/.]+$/, '');
                    await supabase.from('publicacoes').insert([{
                        usuario_id: fotografoId,
                        titulo: 'Fotografia ' + numFoto,
                        localizacao: 'Salvador - BA',
                        imagem_url: publicUrl
                    }]);
                }
            }
        }
    }

    console.log('Processo finalizado com sucesso!');
}

run();
