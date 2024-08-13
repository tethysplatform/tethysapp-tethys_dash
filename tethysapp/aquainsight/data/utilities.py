import math


def set_nonzero(x):
    if x == 0:
        return 0.003
    else:
        return x


def interpolate_stage_from_rating_curve(ratingStage, ratingFlow, flow):

    if flow < 0:
        stage = -9999
    # BELOW
    elif flow < ratingFlow[0]:
        denominator = ratingFlow[1] - ratingFlow[0]
        if denominator == 0:
            stage = 0
        else:
            stage = ratingStage[0] + (
                (ratingStage[1] - ratingStage[0]) / denominator
            ) * (flow - ratingFlow[0])

    # ABOVE
    elif flow > ratingFlow[len(ratingFlow) - 1]:
        stage0 = set_nonzero(ratingStage[len(ratingStage) - 2])
        stage1 = set_nonzero(ratingStage[len(ratingStage) - 1])
        flow0 = set_nonzero(ratingFlow[len(ratingFlow) - 2])
        flow1 = set_nonzero(ratingFlow[len(ratingFlow) - 1])
        flow = set_nonzero(flow)
        denominator = math.log10(flow0) - math.log10(flow1)
        if denominator == 0:
            stage = 0
        else:
            stage = math.pow(
                10,
                math.log10(stage0)
                + ((math.log10(stage1) - math.log10(stage0)) / denominator)
                * (math.log10(flow) - math.log10(flow0)),
            )
    # EQUAL OR INTERPOLATE
    else:
        for idxLoop in range(len(ratingFlow)):
            # EQUAL
            if flow == ratingFlow[idxLoop]:
                stage = ratingStage[idxLoop]
                break
            elif flow < ratingFlow[idxLoop]:
                stage0 = set_nonzero(ratingStage[idxLoop - 1])
                stage1 = set_nonzero(ratingStage[idxLoop])
                flow0 = set_nonzero(ratingFlow[idxLoop - 1])
                flow1 = set_nonzero(ratingFlow[idxLoop])
                flow = set_nonzero(flow)
                if flow0 <= 0:
                    denominator = flow1 - flow0
                    if denominator == 0:
                        stage = 0
                    else:
                        stage = stage0 + ((stage1 - stage0) / denominator) * (
                            flow - flow0
                        )
                else:
                    denominator = math.log10(flow1) - math.log10(flow0)

                if denominator == 0:
                    stage = 0
                else:
                    stage = math.pow(
                        10,
                        math.log10(stage0)
                        + ((math.log10(stage1) - math.log10(stage0)) / denominator)
                        * (math.log10(flow) - math.log10(flow0)),
                    )
                break

    if stage < 0:
        stage = -9999

    return stage


def interpolate_flow_from_rating_curve(ratingStage, ratingFlow, stage):

    if stage < 0:
        flow = -9999
    # BELOW
    elif stage < ratingStage[0]:
        denominator = ratingStage[1] - ratingStage[0]
        if denominator == 0:
            flow = 0
        else:
            flow = ratingFlow[0] + ((ratingFlow[1] - ratingFlow[0]) / denominator) * (
                stage - ratingStage[0]
            )

    # ABOVE
    elif stage > ratingStage[len(ratingStage) - 1]:
        flow0 = set_nonzero(ratingFlow[len(ratingFlow) - 2])
        flow1 = set_nonzero(ratingFlow[len(ratingFlow) - 1])
        stg0 = set_nonzero(ratingStage[len(ratingStage) - 2])
        stg1 = set_nonzero(ratingStage[len(ratingStage) - 1])
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
        flow = -9999

    return flow
