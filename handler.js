const AWS = require('aws-sdk');

const rekognition = new AWS.Rekognition()
const s3 = new AWS.S3({ params: { Bucket: 'pp1grupo11backend-dev-photos' } });
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.register = async (event, context, callback) => {//verificar si el usuario existe
    const data = JSON.parse(event.body);

    const newUser = {
        name: data.name,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
    }

    if (data.photo) {
        const buf = Buffer.from(data.photo.replace(/^data:image\/\w+;base64,/, ""), 'base64')
        await s3.putObject({
            Key: data.email,
            ContentEncoding: 'base64',
            ContentType: 'image/jpeg',
            Body: buf
        }).promise();
    }

    await dynamodb.put({
        TableName: 'users',
        Item: newUser
    }).promise()

    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify(newUser)
    }

}

exports.login = async (event, context, callback) => {
    const data = JSON.parse(event.body);

    const result = await dynamodb.get({
        TableName: 'users',
        Key: {
            email: data.email
        }
    }).promise();

    const user = result.Item;

    let authWithPhoto = false
    if (data.photo) {
        const buf = Buffer.from(data.photo.replace(/^data:image\/\w+;base64,/, ""), 'base64')
        await s3.putObject({
            Key: data.email + '-tmp',
            ContentEncoding: 'base64',
            ContentType: 'image/jpeg',
            Body: buf
        }).promise();

        const params = {
            SimilarityThreshold: 90,
            SourceImage: {
                S3Object: {
                    Bucket: "pp1grupo11backend-dev-photos",
                    Name: data.email
                }
            },
            TargetImage: {
                S3Object: {
                    Bucket: "pp1grupo11backend-dev-photos",
                    Name: data.email + '-tmp'
                }
            }
        };

        const result = await rekognition.compareFaces(params).promise();
        /*
{
    "result": {
        "SourceImageFace": {
            "BoundingBox": {
                "Width": 0.16891629993915558,
                "Height": 0.28472527861595154,
                "Left": 0.2389863282442093,
                "Top": 0.35992804169654846
            },
            "Confidence": 99.99798583984375
        },
        "FaceMatches": [
            {
                "Similarity": 100,
                "Face": {
                    "BoundingBox": {
                        "Width": 0.16891629993915558,
                        "Height": 0.28472527861595154,
                        "Left": 0.2389863282442093,
                        "Top": 0.35992804169654846
                    },
                    "Confidence": 99.99798583984375,
                    "Landmarks": [
                        {
                            "Type": "eyeLeft",
                            "X": 0.2976287007331848,
                            "Y": 0.4695330262184143
                        },
                        {
                            "Type": "eyeRight",
                            "X": 0.36928078532218933,
                            "Y": 0.4606936573982239
                        },
                        {
                            "Type": "mouthLeft",
                            "X": 0.31326839327812195,
                            "Y": 0.5700832009315491
                        },
                        {
                            "Type": "mouthRight",
                            "X": 0.3729500472545624,
                            "Y": 0.5624081492424011
                        },
                        {
                            "Type": "nose",
                            "X": 0.3500348627567291,
                            "Y": 0.506821870803833
                        }
                    ],
                    "Pose": {
                        "Roll": -2.5413894653320312,
                        "Yaw": 12.703316688537598,
                        "Pitch": 14.723536491394043
                    },
                    "Quality": {
                        "Brightness": 69.40294647216797,
                        "Sharpness": 53.330047607421875
                    }
                }
            }
        ],
        "UnmatchedFaces": []
    }
}
        */
        authWithPhoto = result.FaceMatches.some(fm => fm.Similarity > 90)
    }


    if (user && (user.password == data.password || authWithPhoto)) {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({
                user
            })
        };
    }
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
        },
        body: "Not found"
    };



}