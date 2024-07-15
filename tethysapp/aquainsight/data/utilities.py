import math


def set_nonzero(x):
    if x == 0:
        return 0.003
    else:
        return x


def interpolate_flow_from_rating_curve(ratingStage, ratingFlow, stage):

    # BELOW
    if stage < ratingStage[0]:
        denominator = ratingStage[1] - ratingStage[0]
        if denominator == 0:
            flow = 0
        else:
            flow = ratingFlow[0] + ((ratingFlow[1] - ratingFlow[0]) / denominator) * (
                stage - ratingStage[0]
            )

    # ABOVE
    elif stage > ratingStage[len(ratingStage) - 1]:
        flow0 = set_nonzero(ratingFlow[ratingFlow.length - 2])
        flow1 = set_nonzero(ratingFlow[ratingFlow.length - 1])
        stg0 = set_nonzero(ratingStage[ratingStage.length - 2])
        stg1 = set_nonzero(ratingStage[ratingStage.length - 1])
        stage = set_nonzero(stage)
        denominator = math.log10(stg1) - math.log10(stg0)
        if denominator == 0:
            flow = 0
        else:
            flow = math.pow(
                10,
                math.log10(flow0)
                + ((math.log10(flow1) - math.log10(flow0)) / denominator)
                * (math.log10(stage) - math.log10(stg0)),
            )
    # EQUAL OR INTERPOLATE
    else:
        for idxLoop in range(len(ratingStage)):
            # EQUAL
            if stage == ratingStage[idxLoop]:
                flow = ratingFlow[idxLoop]
                break
            elif stage < ratingStage[idxLoop]:
                flow0 = set_nonzero(ratingFlow[idxLoop - 1])
                flow1 = set_nonzero(ratingFlow[idxLoop])
                stg0 = set_nonzero(ratingStage[idxLoop - 1])
                stg1 = set_nonzero(ratingStage[idxLoop])
                stage = set_nonzero(stage)
                if stg0 <= 0:
                    denominator = stg1 - stg0
                    if denominator == 0:
                        flow = 0
                    else:
                        flow = flow0 + ((flow1 - flow0) / denominator) * (stage - stg0)
                else:
                    denominator = math.log10(stg1) - math.log10(stg0)

                if denominator == 0:
                    flow = 0
                else:
                    flow = math.pow(
                        10,
                        math.log10(flow0)
                        + ((math.log10(flow1) - math.log10(flow0)) / denominator)
                        * (math.log10(stage) - math.log10(stg0)),
                    )
                break

    if flow < 0:
        flow = 0

    return flow
