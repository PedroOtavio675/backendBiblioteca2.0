const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const multer = require('multer')
const path = require('path')
const { Pool } = require("pg")
const PORT = 3000
const cors = require('cors')
app.use(cors())
require("dotenv").config();

app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});


//dados do banco de dados
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // necessário para Railway
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }  // SSL tbm aqui se usar variáveis separadas
      }
);
pool.connect()
  .then(() => console.log("Conectado ao banco de dados com sucesso"))
  .catch(err => console.error("Erro ao conectar ao banco:", err));

// Configuração do multer para upload de arquivos
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "livros", // pasta no Cloudinary
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

const upload = multer({ storage })


// Rota para inserir livros
app.post('/InserirLivros', upload.single("imagem"), async (req, res)=>{

   try{

    const { isbn, titulo, autor } = req.body
    const imageUrl = req.file.path; // URL gerada pelo Cloudinary

   const result = await  pool.query(`
        INSERT INTO livros (isbn, caminho_capa, titulo_livro, autor_livro)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
        `,[isbn, imageUrl, titulo, autor])

        const idNovo = result.rows[0].id

          res.status(201).json({
            mensagem:"Livro inserido com sucesso.",
            idCadastrado: idNovo
        });

   }catch(err){
        console.error("Erro ao inserir livro:", err);
    res.status(500).send("Erro ao inserir livro.");
    
   }
})


// Rota para listar livros
app.get("/livrosDoBanco", async (req, res)=>{

    try{
        const result = await pool.query(`
            SELECT * FROM livros 
            `)
            res.json(result.rows)
    }catch(err){
        alert(err)
    }
})

// Rota para registrar usuários
app.post('/registrarUsuario', async (req, res)=>{
    const {nome, email, senha, cpf} = req.body
    
    const senhaHash = await bcrypt.hash(senha, 10)

    try{
        pool.query(`
            INSERT INTO usuarios (nome_usuario, email_usuario, senha_hash_usuario, cpf_usuario)
            VALUES($1, $2, $3, $4)
            `,[nome, email, senhaHash, cpf])
            res.status(201).send("Usuario cadastrado")
    }catch(err){
        console.error(err)
         res.status(500).send('Erro ao cadastrar no banco')
    }
})


// Rotas para autenticar usuários
app.post('/verificarSeCPFJaExiste', async (req, res)=>{
    const {cpf} = req.body

    try{
const result = await pool.query(`
        SELECT 1 FROM usuarios
        WHERE cpf_usuario = $1
        LIMIT 1;
        `, [cpf])
    res.json(result.rows)
    }catch(err){
      console.log(err);
    }

})
app.post("/verificarSeEmailJaExiste", async (req, res)=>{
    const {email} = req.body

    try{
 const result = await pool.query(`
        SELECT 1 FROM usuarios
        WHERE email_usuario = $1
        LIMIT 1
        `,[email])

        res.json(result.rows)
    }catch(err){
        console.log(err);
    }
   
} )


// Rotas para verificar se o livros ja está retirado/existe e se o usuario ja tem livros ritirados.
app.post("/verificarLivroExiste", async (req, res)=>{
    const {id} = req.body

    try{
        const result = await pool.query(`
            SELECT 1 FROM livros
            WHERE id = $1
            LIMIT 1
            `,[id])
            
            res.status(200).json(result.rows);
    }catch(err){
        console.error(err)
            res.status(404).send("Erro ao encontrar.")
    }
});


// Rota para fazer a retirada
app.post("/fazerRetirada", async (req, res)=>{
     const {id, cpf, dataDevolucao, observacoes} = req.body
    try{
         await pool.query(`
            INSERT INTO retiradas_livros (cpf_usuario, data_prevista_devolucao, observacoes)
            VALUES($1, $2, $3);
            `,[cpf, dataDevolucao, observacoes])

        await pool.query(`
            UPDATE livros
            SET status = 'pendente'
            WHERE isbn = $1;
            `,[id])
            res.status(200).json({
                mensagem:"Livro retirado"})
    }catch(err){
        console.error(err)
        res.status(400).json({
            mensagem:"Nao foi possivel fazer a retirada"})
    }
})


// Rota para verificar se o livro está pendente
app.post("/verificarRetiradas", async (req, res)=>{
     const {id} = req.body
    try{
        const result = await pool.query(`
            SELECT 1 FROM retiradas_livro
            WHERE id = $1;
            `,[id])

            res.json(result.rows)
    }catch(err){
        console.error(err)
        res.status(404).send("Não foi possível comunicar com o banco")
    }
})

app.listen(PORT,()=>{console.log("Funcionando");
})