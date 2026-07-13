import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
import { workerEvents } from '../events/constants.js';

console.log('Model training worker initialized');
let _globalCtx = {};
let _model = {};

const WEIGHT = {
    category: 0.4,
    color: 0.3,
    price: 0.2,
    age: 0.1
}

const normalize = (value, min, max) => (value - min) / ((max - min) || 1) 

function makeContext(products, users) {
    const ages = users.map(u => u.age)
    const prices = products.map(p => p.price)

    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)

    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    const colors = [...new Set(products.map(p => p.color))]
    const categories = [...new Set(products.map(p => p.category))]

    const colorsIndex = Object.fromEntries(
        colors.map((color, index) => {
            return [color, index]
        }))

    const categoriesIndex = Object.fromEntries(
        categories.map((category, index) => {
            return [category, index]
        }))

    // Computar a média de idade dos compradores por produto
    // (ajuda a personalizar)

    const midAge = (minAge + maxAge) / 2
    const ageSums = {}
    const ageCounts = {}

    users.forEach(user => {
        user.purchases.forEach(p => {
            ageSums[p.name] = (ageSums[p.name] || 0) + user.age
            ageCounts[p.name] = (ageCounts[p.name] || 0) + 1
        })
    })

    const productAvgAgeNorm = Object.fromEntries(
        products.map(product => {
            const avg = ageCounts[product.name] ? 
                ageSums[product.name] / ageCounts[product.name] : 
                midAge
            
            return [product.name, normalize(avg, minAge, maxAge)]
        })
    )

    return {
        products,
        users,
        colorsIndex,
        categoriesIndex,
        minAge,
        maxAge,
        minPrice,
        maxPrice,
        numCategories: categories.length,
        numColors: colors.length,
        dimentions: 2 + categories.length + colors.length,
        productAvgAgeNorm
    }
}

const oneHotWeighted = (index, length, weight) => {
    return tf.oneHot(index, length).cast('float32').mul(weight)
}

function encodeProduct(product, ctx) {
    const price = tf.tensor1d([normalize(product.price, ctx.minPrice, ctx.maxPrice) * WEIGHT.price])
    const age = tf.tensor1d([
        (ctx.productAvgAgeNorm[product.name] ?? 0.5) * WEIGHT.age
    ])

    const category = oneHotWeighted(
        ctx.categoriesIndex[product.category],
        ctx.numCategories,
        WEIGHT.category
    )

    const color = oneHotWeighted(
        ctx.colorsIndex[product.color],
        ctx.numColors,
        WEIGHT.color
    )

    return tf.concat1d([price, category, color, age])
}

function encodeUser(user, ctx) {
    if (user.purchases.length) {
        return tf.stack(
            user.purchases.map(
                product => encodeProduct(product, ctx)
            )
        )
            .mean(0)
            .reshape([
                1,
                ctx.dimentions
            ])
    }
    return tf.concat1d(
        [
            tf.zeros([1]), // preço é ignorado,
            tf.tensor1d([
                normalize(user.age, ctx.minAge, ctx.maxAge)
                * WEIGHT.age
            ]),
            tf.zeros([ctx.numCategories]), // categoria ignorada,
            tf.zeros([ctx.numColors]), // color ignorada,

        ]
    ).reshape([1, ctx.dimentions])
}

function createTrainingData(ctx) {
    const inputs = []
    const labels = []
    ctx.users
    .filter(user => user.purchases.length)
    .forEach(user => {
        const userVector = encodeUser(user, ctx).dataSync()
        ctx.products.forEach(product => {
            const productVector = encodeProduct(product, ctx).dataSync()

            const label = user.purchases.some(p => p.name === product.name) ? 1 : 0

            inputs.push([...userVector, ...productVector])
            labels.push(label)

        })

    })
    return {
        xs: tf.tensor2d(inputs),
        ys: tf.tensor2d(labels, [labels.length, 1]),
        inpuDimention: ctx.dimentions * 2
    }
}

async function configureNeuralNetAndTrain(trainData) {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [trainData.inpuDimention], units: 128, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    model.compile({
        optimizer: tf.train.adam(),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
    });

    await model.fit(trainData.xs, trainData.ys, {
        epochs: 100,
        batchSize: 32,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                postMessage({
                    type: workerEvents.trainingLog,
                    epoch: epoch,   
                    loss: logs.loss,
                    accuracy: logs.acc
                });
            }
        }
    });

    return model;
}

async function trainModel({ users }) {
    console.log('Training model with users:', users)

    postMessage({ type: workerEvents.progressUpdate, progress: { progress: 50 } });

    const products = await (await fetch('/data/products.json')).json()

    const context = makeContext(products, users)

    context.productVectors = products.map(product => {
        return {
            name: product.name,
            meta: {...product},
            vector: encodeProduct(product, context).dataSync()
        }
    })

    _globalCtx = context

    const trainData = createTrainingData(context)

    _model = await configureNeuralNetAndTrain(trainData)

    postMessage({
        type: workerEvents.trainingLog,
        epoch: 1,
        loss: 1,
        accuracy: 1
    });

    setTimeout(() => {
        postMessage({ type: workerEvents.progressUpdate, progress: { progress: 100 } });
        postMessage({ type: workerEvents.trainingComplete });
    }, 1000);


}
function recommend({user}) {
    if (!_model) return;

    const context = _globalCtx
    
    const userVectorr = encodeUser(user, context).dataSync()

    const inputs = context.productVectors.map(({vector}) => {
        return [...userVectorr, ...vector]
    })

    const inputTensor = tf.tensor2d(inputs)
    const predictions = _model.predict(inputTensor)

    const scores = predictions.dataSync()

    const recommendations = context.productVectors.map((product, index) => {
        return {
            ...product.meta,
            name: product.name,
            score: scores[index]
        }
    })

    const sortedItems = recommendations.sort((a, b) => b.score - a.score)
    
    postMessage({
         type: workerEvents.recommend,
         user,
         recommendations: sortedItems
    });
}


const handlers = {
    [workerEvents.trainModel]: trainModel,
    [workerEvents.recommend]: d => recommend(d),
};

self.onmessage = e => {
    const { action, ...data } = e.data;
    if (handlers[action]) handlers[action](data);
};
