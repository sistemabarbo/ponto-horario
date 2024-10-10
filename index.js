const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const { Parser } = require('json2csv');
const path = require('path');
const pg = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config(); 
const session = require('express-session');
const app = express();
// Configurando middleware de sessão
app.use(session({
    secret: 'seuSegredoAqui',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 30 * 60 * 1000 }  // Em produção, mude para true e use HTTPS
}));
  




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
app.get('/', verificarAutenticacao, async (req, res) => {
    try {
        const result = await db.query('SELECT id, nome FROM funcionarios');
        res.render('index', { funcionarios: result.rows });
    } catch (err) {
        console.error('Erro ao buscar funcionários:', err);
        return res.status(500).send('Erro ao buscar funcionários');
    }
});


// Rota para bater o ponto de entrada
// Rota para bater o ponto de entrada
app.post('/ponto/entrada', async (req, res) => {
    const { funcionario_id } = req.body;

    // Obter a data atual
    const dataAtual = new Date();
    const horaEntrada = dataAtual.toTimeString().slice(0, 8); // Obtendo apenas o tempo (HH:mm:ss)

    const resultPonto = await db.query(
        'SELECT * FROM pontos WHERE funcionario_id = $1 AND DATE(data) = $2',
        [funcionario_id, dataAtual.toISOString().slice(0, 10)] // Formato YYYY-MM-DD
    );

    if (resultPonto.rows.length > 0) {
        return res.status(400).json({ message: 'Já existe uma entrada registrada para hoje.' });
    }

    // Verifica se a hora de entrada é maior que 22h (10 PM)
    if (dataAtual.getHours() >= 22) {
        // Se sim, ajusta a data para o dia seguinte
        dataAtual.setDate(dataAtual.getDate() + 1);
    }

    // Inserir nova entrada
    const sql = 'INSERT INTO pontos (funcionario_id, entrada, data) VALUES ($1, $2, $3)';
    await db.query(sql, [funcionario_id, horaEntrada, dataAtual]);

    return res.status(200).json({ message: 'Entrada registrada com sucesso!' });
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
// Rota para bater o ponto de saída
app.post('/ponto/saida', async (req, res) => {
    const { funcionario_id } = req.body;
    const dataAtual = new Date();
    const dataAtualFormatada = dataAtual.toISOString().slice(0, 10); // YYYY-MM-DD
    const horaSaida = dataAtual.toTimeString().slice(0, 8); // HH:mm:ss

    try {
        // Consulta o ponto de entrada para calcular as horas trabalhadas
        const resultEntrada = await db.query(
            'SELECT entrada, data FROM pontos WHERE funcionario_id = $1 AND DATE(data) = $2',
            [funcionario_id, dataAtualFormatada]
        );

        if (resultEntrada.rows.length > 0) {
            return res.status(400).json({ message: 'Já existe uma volta do almoço registrada para hoje.' });
        }

        const horaEntrada = new Date(`${resultEntrada.rows[0].data}T${resultEntrada.rows[0].entrada}`);
        let horaSaidaCompleta = new Date(`${dataAtualFormatada}T${horaSaida}`);

        // Se a saída ocorrer antes das 6h da manhã, ajusta a data da saída para o dia anterior
        if (horaSaidaCompleta.getHours() < 6) {
            horaSaidaCompleta.setDate(horaSaidaCompleta.getDate() - 1); // Ajusta para o dia anterior
        }

        // Adiciona condições específicas para ajustes de horas após a meia-noite
        if (horaSaida === "03:00:00") { 
            horaSaidaCompleta.setHours(23, 0, 0); // Ajusta para 23:00 do dia anterior
            horaSaidaCompleta.setHours(horaSaidaCompleta.getHours() + 4); // Adiciona 4 horas
        } else if (horaSaida >= "02:00:00" && horaSaida < "03:00:00") { 
            horaSaidaCompleta.setHours(23, 0, 0); // Ajusta para 23:00 do dia anterior
            horaSaidaCompleta.setHours(horaSaidaCompleta.getHours() + 3, 30); // Adiciona 3 horas e meia
        } else if (horaSaida < "02:00:00" && horaSaida >= "01:00:00") {
            horaSaidaCompleta.setHours(23, 45, 0); // Ajusta para 23:45 do dia anterior
            horaSaidaCompleta.setHours(horaSaidaCompleta.getHours() + 3, 15); // Adiciona 3 horas e 15 minutos
        } else if (horaSaida > "00:00:00" && horaSaida < "01:00:00") {
            horaSaidaCompleta.setHours(23, 30, 0); // Ajusta para 23:30 do dia anterior
            horaSaidaCompleta.setHours(horaSaidaCompleta.getHours() + 3); // Adiciona 3 horas
        }
        

        // Calcula horas extras após as 22:00
        const horasExtras = calcularHorasExtras(horaEntrada, horaSaidaCompleta);

        // Atualiza o ponto de saída e horas extras no banco de dados
        const sql = 'UPDATE pontos SET saida = $1, horas_extras = $2 WHERE funcionario_id = $3 AND data = $4';
        await db.query(sql, [horaSaidaCompleta.toTimeString().slice(0, 8), horasExtras, funcionario_id, resultEntrada.rows[0].data]);

        return res.status(200).json({ message: 'Ponto de saída registrado com sucesso!', horasExtras });

    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        return res.status(500).json({ error: 'Erro ao registrar saída' });
    }
});

function calcularHorasExtras(horaEntrada, horaSaidaCompleta) {
    const hora22 = new Date(horaSaidaCompleta);
    hora22.setHours(22, 0, 0); // Define 22:00:00 no mesmo dia

    let horasExtras = 0;

    // Se a saída for após 22 horas
    if (horaSaidaCompleta > hora22) {
        // Horas normais até 22:00
        const horasTrabalhadasAte22 = (hora22 - horaEntrada) / 3600000; // Horas até 22:00
        const horasTrabalhadasApos22 = (horaSaidaCompleta - hora22) / 3600000; // Horas após 22:00

        // Dobra as horas após 22:00
        horasExtras = horasTrabalhadasApos22 * 2;
    }

    return horasExtras;
}


app.get('/relatorio', (req, res) => {
    const { funcionario_id, data_inicio, data_fim } = req.query;
    const jornadaEsperada = 8 * 60; // Jornada diária esperada em minutos (8 horas = 480 minutos)

    const sql = `
        SELECT 
            data, 
            entrada, 
            saida_almoco, 
            volta_almoco, 
            saida,
            horas_extras,
            -- Cálculo das horas trabalhadas
            (EXTRACT(epoch FROM (saida - entrada)) / 60) - 
            (EXTRACT(epoch FROM (volta_almoco - saida_almoco)) / 60) AS horas_trabalhadas
        FROM pontos 
        WHERE funcionario_id = $1 AND data BETWEEN $2 AND $3;
    `;

    db.query(sql, [funcionario_id, data_inicio, data_fim], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Erro ao gerar relatório' });
        } else {
            const pontos = result.rows;
            let saldoTotal = 0; // saldo total em minutos

            // Calculando o saldo de horas de cada dia
            pontos.forEach(ponto => {
                const saida = new Date(`${ponto.data}T${ponto.saida}`);
                const entrada = new Date(`${ponto.data}T${ponto.entrada}`);

                // Se a saída for antes de 6h da manhã, considera a saída do dia anterior
                if (saida.getHours() < 6) {
                    saida.setDate(saida.getDate() - 1);
                }

                // Calcula as horas trabalhadas em minutos
                const horasTrabalhadasEmMinutos = (saida - entrada) / 60000; // Em minutos

                // Cálculo do saldo diário
                const saldoDiario = horasTrabalhadasEmMinutos - jornadaEsperada;
                ponto.saldo_diario = saldoDiario / 60; // Converte saldo diário para horas

                // Cálculo de horas extras após 22h
                let horasExtras = 0;
                const hora22 = new Date(ponto.data);
                hora22.setHours(22, 0, 0); // Define 22:00:00

                // Se a saída for após 22:00
                if (saida > hora22) {
                    const horasTrabalhadasApos22 = (saida - hora22) / 60000; // Horas após 22:00 em minutos
                    horasExtras = horasTrabalhadasApos22 * 2; // Dobra as horas extras
                }

                // Atualiza o saldo total
                saldoTotal += saldoDiario + horasExtras; // Acumula saldo diário e horas extras em minutos

                // Formata a data no formato dd-mm-yy
                const data = new Date(ponto.data); // Converte a data para objeto Date
                ponto.data = data.toLocaleDateString('pt-BR'); // Formata a data
            });

            // Formata saldo total para horas e minutos
            const saldoTotalHoras = Math.floor(saldoTotal / 60);
            const saldoTotalMinutos = saldoTotal % 60;

            res.json({
                pontos, 
                saldoTotal: saldoTotalHoras + saldoTotalMinutos / 60 // Saldo total em formato decimal
            });
        }
    });
});





app.get('/relatorio/exportar', (req, res) => {
    const { funcionario_id, data_inicio, data_fim } = req.query;

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
            return res.status(500).json({ error: 'Erro ao gerar relatório' });
        }

        const pontos = result.rows;

        // Converte os dados para CSV
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(pontos);

        // Define o cabeçalho para download do CSV
        res.header('Content-Type', 'text/csv');
        res.attachment('relatorio_horas_trabalhadas.csv');
        res.send(csv);
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
app.get('/login', (req, res) => {
    res.render('login'); // Certifique-se de que 'login.ejs' esteja no diretório correto, como 'views/login.ejs'
});
app.post('/login', async (req, res) => {
    const { funcionario_id, senha } = req.body;

    try {
        const result = await db.query('SELECT senha FROM funcionarios WHERE id = $1', [funcionario_id]);

        // Verifica se o funcionário foi encontrado
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Funcionário não encontrado.' });
        }

        const senhaCorreta = result.rows[0].senha;

        // Comparação direta da senha (sem bcrypt)
        console.log(`Senha no banco: ${senhaCorreta}, Senha inserida: ${senha}`);

        if (senha !== senhaCorreta) {
            return res.status(403).json({ message: 'Senha incorreta.' });
        }

        // Login bem-sucedido, criar sessão
        req.session.funcionarioId = funcionario_id;
        return res.status(200).json({ message: 'Login realizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao realizar login:', error);
        return res.status(500).json({ message: 'Erro ao realizar login' });
    }
});



function verificarAutenticacao(req, res, next) {
    console.log('Sessão:', req.session);
    if (req.session && req.session.funcionarioId) {
        return next();
    } else {
        return res.redirect('/login');
    }
}




// Rota protegida para o ponto
app.get('/index/:funcionario_id', verificarAutenticacao, async (req, res) => {
    
    const funcionarioId = req.params.funcionario_id;

    try {
        const result = await db.query('SELECT id, nome FROM funcionarios');
        res.render('index', { funcionarios: result.rows, funcionarioLogado: funcionarioId });
    } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        res.status(500).send('Erro ao buscar funcionários');
    }
});
app.post('/verificar-senha', (req, res) => {
    const { senha } = req.body;
    
    // Defina a senha correta
    const senhaCorreta = '123';  // Defina uma senha segura ou use um hash de senha

    if (senha === senhaCorreta) {
        // Senha correta, retorna sucesso
        res.json({ autenticado: true });
    } else {
        // Senha incorreta, retorna erro
        res.json({ autenticado: false });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Erro ao fazer logout');
        }
        res.redirect('/login');
    });
});


app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
