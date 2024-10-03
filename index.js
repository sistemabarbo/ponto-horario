const express = require('express');
const path = require('path');
const pg = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config(); 
const app = express();
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public/views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const port = 3000;

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const db = new pg.Client(config);

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database');
   // queryDatabase();
});
app.get('/', (req, res) => {
    db.query('SELECT id, nome FROM funcionarios', (err, result) => {
        if (err) {
            return res.status(500).send('Erro ao buscar funcionários');
        }
        res.render('index', { funcionarios: result.rows });
    });
});

// Rota para bater o ponto de entrada
app.post('/ponto/entrada', async (req, res) => {
    const { funcionario_id } = req.body;

    // Obter a data atual
    const dataAtual = new Date(); // Captura a data e hora atual
    const horaEntrada = dataAtual.toTimeString().slice(0, 8); // Obtendo apenas o tempo (HH:mm:ss)

    try {
        // Consulta para verificar se já existe uma entrada no dia atual
        const result = await db.query(
            'SELECT * FROM pontos WHERE funcionario_id = $1 AND DATE(data) = $2',
            [funcionario_id, dataAtual.toISOString().slice(0, 10)] // Formato YYYY-MM-DD
        );

        if (result.rows.length > 0) {
            // Já existe uma entrada para hoje
            return res.status(400).json({ message: 'Já existe uma entrada registrada para hoje.' });
        }

        // Inserir nova entrada
        const sql = 'INSERT INTO pontos (funcionario_id, entrada, data) VALUES ($1, $2, $3)';
        await db.query(sql, [funcionario_id, horaEntrada, dataAtual]); // Passando horaEntrada e dataAtual

        return res.status(200).json({ message: 'Entrada registrada com sucesso!' });

    } catch (error) {
        console.error('Erro ao consultar ou registrar a entrada:', error);
        return res.status(500).json({ error: 'Erro ao consultar o banco de dados' });
    }
});

// Rota para bater o ponto de saída para o almoço
app.post('/ponto/saida-almoco', async (req, res) => {
    const { funcionario_id } = req.body;
    const dataAtual = new Date();
    const dataAtualFormatada = dataAtual.toISOString().slice(0, 10); // YYYY-MM-DD
    const horaSaidaAlmoco = dataAtual.toTimeString().slice(0, 8); // HH:mm:ss

    try {
        // Verifica se já existe uma saída para o almoço registrada
        const result = await db.query(
            'SELECT * FROM pontos WHERE funcionario_id = $1 AND DATE(data) = $2 AND saida_almoco IS NOT NULL',
            [funcionario_id, dataAtualFormatada]
        );

        if (result.rows.length > 0) {
            return res.status(400).json({ message: 'Já existe uma saída para o almoço registrada para hoje.' });
        }

        // Atualiza a saída para o almoço
        const sql = 'UPDATE pontos SET saida_almoco = $1 WHERE funcionario_id = $2 AND data = $3';
        await db.query(sql, [horaSaidaAlmoco, funcionario_id, dataAtual]);

        return res.status(200).json({ message: 'Ponto de saída para o almoço registrado com sucesso!' });

    } catch (error) {
        console.error('Erro ao registrar saída para o almoço:', error);
        return res.status(500).json({ error: 'Erro ao registrar saída para o almoço' });
    }
});

// Rota para bater o ponto de volta do almoço
app.post('/ponto/volta-almoco', async (req, res) => {
    const { funcionario_id } = req.body;
    const dataAtual = new Date();
    const dataAtualFormatada = dataAtual.toISOString().slice(0, 10); // YYYY-MM-DD
    const horaVoltaAlmoco = dataAtual.toTimeString().slice(0, 8); // HH:mm:ss

    try {
        // Verifica se já existe uma volta do almoço registrada
        const result = await db.query(
            'SELECT * FROM pontos WHERE funcionario_id = $1 AND DATE(data) = $2 AND volta_almoco IS NOT NULL',
            [funcionario_id, dataAtualFormatada]
        );

        if (result.rows.length > 0) {
            return res.status(400).json({ message: 'Já existe uma volta do almoço registrada para hoje.' });
        }

        // Atualiza a volta do almoço
        const sql = 'UPDATE pontos SET volta_almoco = $1 WHERE funcionario_id = $2 AND data = $3';
        await db.query(sql, [horaVoltaAlmoco, funcionario_id, dataAtual]);

        return res.status(200).json({ message: 'Ponto de volta do almoço registrado com sucesso!' });

    } catch (error) {
        console.error('Erro ao registrar volta do almoço:', error);
        return res.status(500).json({ error: 'Erro ao registrar volta do almoço' });
    }
});

// Rota para bater o ponto de saída
app.post('/ponto/saida', async (req, res) => {
    const { funcionario_id } = req.body;
    const dataAtual = new Date();
    const dataAtualFormatada = dataAtual.toISOString().slice(0, 10); // YYYY-MM-DD
    const horaSaida = dataAtual.toTimeString().slice(0, 8); // HH:mm:ss

    try {
        // Verifica se já existe uma saída registrada
        const result = await db.query(
            'SELECT * FROM pontos WHERE funcionario_id = $1 AND DATE(data) = $2 AND saida IS NOT NULL',
            [funcionario_id, dataAtualFormatada]
        );

        if (result.rows.length > 0) {
            return res.status(400).json({ message: 'Já existe uma saída registrada para hoje.' });
        }

        // Atualiza a saída
        const sql = 'UPDATE pontos SET saida = $1 WHERE funcionario_id = $2 AND data = $3';
        await db.query(sql, [horaSaida, funcionario_id, dataAtual]);

        return res.status(200).json({ message: 'Ponto de saída registrado com sucesso!' });

    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        return res.status(500).json({ error: 'Erro ao registrar saída' });
    }
});

app.get('/relatorio', (req, res) => {
    const { funcionario_id, data_inicio, data_fim } = req.query;
    console.log("req", req.query);
    const jornadaEsperada = 8 * 60; // Convertendo horas diárias esperadas para minutos

    const sql = `
        SELECT 
            data, 
            entrada, 
            saida_almoco, 
            volta_almoco, 
            saida, 
            EXTRACT(epoch FROM (saida - entrada)) / 60 - EXTRACT(epoch FROM (volta_almoco - saida_almoco)) / 60 AS horas_trabalhadas 
        FROM pontos 
        WHERE funcionario_id = $1 AND data BETWEEN $2 AND $3
    `;

    db.query(sql, [funcionario_id, data_inicio, data_fim], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Erro ao gerar relatório' });
        } else {
            const pontos = result.rows;
            let saldoTotal = 0; // saldo total de minutos

            // Calculando o saldo de horas de cada dia
            pontos.forEach(ponto => {
                const horasTrabalhadasEmMinutos = ponto.horas_trabalhadas || 0; // em caso de ausência de dados
                const saldoDiario = horasTrabalhadasEmMinutos - jornadaEsperada;
                ponto.saldo_diario = saldoDiario / 60; // Converte saldo diário para horas
                saldoTotal += saldoDiario;  // Acumula saldo diário em minutos
            });

            // Adiciona o saldo total em horas
            res.json({ pontos, saldoTotal: saldoTotal / 60 });  // Saldo total também em horas
        }
    });
});


// Rota para cadastrar um novo funcionário
app.post('/funcionarios/cadastrar', (req, res) => {
    try{
    const { nome, email, senha } = req.body;
    console.log("req", req.body);
    // Validação básica para garantir que os campos foram preenchidos
  ////  if (!nome || !email || !senha) {
  //      return res.status(400).send('Todos os campos são obrigatórios!');
 //   }

    // Consulta SQL para inserir um novo funcionário
    const sql = 'INSERT INTO funcionarios (nome, email, senha) VALUES ($1, $2, $3)';
    console.log("sql", sql);
    db.query(sql, [nome, email, senha], (err, result) => {
        if (err) {
            if (err.code === '23505') { 
                return res.status(400).send('Email já cadastrado.');
            }
            console.log("error", err)
            return res.status(500).send('Erro ao cadastrar funcionário');
        }

        res.redirect('/');
    });
}catch(e){
    console.error("error", e);
}
});
app.get('/funcionarios', (req, res) => {
    const sql = 'SELECT id, nome FROM funcionarios';
    db.query(sql, (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Erro ao buscar funcionários' });
        } else {
            res.json(result.rows);  // Retorna uma lista de funcionários com id e nome
        }
    });
});

app.post('/ponto/editar', (req, res) => {
    const { funcionario_id, data, entrada, saida_almoco, volta_almoco, saida } = req.body;

    const sql = `
        UPDATE pontos 
        SET entrada = $1, saida_almoco = $2, volta_almoco = $3, saida = $4
        WHERE funcionario_id = $5 AND data = $6
    `;
    db.query(sql, [entrada, saida_almoco, volta_almoco, saida, funcionario_id, data], (err, result) => {
        if (err) return res.status(500).send('Erro ao editar ponto');
        res.send('Registro de ponto atualizado com sucesso');
    });
});

app.post('/deletar-funcionario', (req, res) => {
    try {
        const { funcionario_id } = req.body;

        if (!funcionario_id) {
            return res.status(400).json({ message: 'ID do funcionário é obrigatório' });
        }

        const deletePontosSQL = 'DELETE FROM pontos WHERE funcionario_id = $1';
        const deleteFuncionarioSQL = 'DELETE FROM funcionarios WHERE id = $1';

        // Primeiro, excluímos os registros relacionados na tabela pontos
        db.query(deletePontosSQL, [funcionario_id], (err, result) => {
            if (err) {
                console.error('Erro ao excluir pontos relacionados:', err);
                return res.status(500).json({ message: 'Erro ao excluir pontos relacionados' });
            }

            // Agora excluímos o funcionário
            db.query(deleteFuncionarioSQL, [funcionario_id], (err, result) => {
                if (err) {
                    console.error('Erro ao deletar funcionário:', err);                    
                }

                if (result.rowCount === 0) {                    
                }

                res.redirect('/');
            });
        });
    } catch (e) {
        console.error('Erro no servidor:', e);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});



app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
